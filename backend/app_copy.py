from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import json
import os
from pathlib import Path as PathLib
from typing import Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Interactive Storybook API",
    description="Backend API for multilingual interactive storybook application",
    version="1.0.0"
)

# CORS middleware configuration - allows frontend to communicate with backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base directory paths
BASE_DIR = PathLib(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
ASSETS_DIR = BASE_DIR / "assets"
IMAGES_DIR = ASSETS_DIR / "images"

# Cache for JSON files to avoid repeated file reads
_languages_cache = None
_sentences_cache = None


def load_json_file(file_path: PathLib) -> dict:
    """Load and parse JSON file with error handling"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error(f"File not found: {file_path}")
        raise HTTPException(status_code=404, detail=f"Configuration file not found: {file_path.name}")
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {file_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Invalid JSON format in {file_path.name}")


def get_languages():
    """Load languages configuration with caching"""
    global _languages_cache
    if _languages_cache is None:
        _languages_cache = load_json_file(DATA_DIR / "languages.json")
    return _languages_cache


def get_sentences():
    """Load sentences configuration with caching"""
    global _sentences_cache
    if _sentences_cache is None:
        _sentences_cache = load_json_file(DATA_DIR / "sentences.json")
    return _sentences_cache


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal attacks"""
    # Remove any path separators and parent directory references
    filename = os.path.basename(filename)
    filename = filename.replace("..", "").replace("/", "").replace("\\", "")
    return filename


def get_audio_file_path(language: str, sentence_id: str, audio_id: str) -> Optional[PathLib]:
    """
    Construct and validate audio file path
    Returns full path if file exists, None otherwise
    """
    # Sanitize inputs
    language = sanitize_filename(language)
    sentence_id = sanitize_filename(sentence_id)
    audio_id = sanitize_filename(audio_id.lower())
    
    # Construct base path
    audio_base_path = ASSETS_DIR / language / "sentences" / sentence_id / "audio"
    
    # Try to find the audio file with common extensions
    extensions = ['.mp3', '.wav', '.ogg', '.m4a']
    
    for ext in extensions:
        audio_file = audio_base_path / f"{audio_id}{ext}"
        if audio_file.exists() and audio_file.is_file():
            # Security check: ensure the resolved path is within ASSETS_DIR
            if ASSETS_DIR in audio_file.parents:
                return audio_file
    
    return None


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Interactive Storybook API",
        "version": "1.0.0",
        "endpoints": {
            "languages": "/languages",
            "sentences": "/sentences",
            "page": "/sentences/page/{page_number}",
            "audio": "/audio/{language}/{sentence_id}/{audio_id}",
            "image": "/images/{image_name}"
        }
    }


@app.get("/languages")
async def get_languages_endpoint():
    """
    Get list of available languages
    Returns: JSON object with language configurations
    """
    try:
        languages_data = get_languages()
        logger.info(f"Languages retrieved: {len(languages_data.get('languages', []))} languages")
        return JSONResponse(content=languages_data)
    except Exception as e:
        logger.error(f"Error retrieving languages: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve languages")


@app.get("/sentences")
async def get_all_sentences():
    """
    Get complete sentences configuration for all pages
    Returns: JSON object with all page content
    """
    try:
        sentences_data = get_sentences()
        logger.info(f"Sentences retrieved: {sentences_data.get('metadata', {}).get('total_pages', 0)} pages")
        return JSONResponse(content=sentences_data)
    except Exception as e:
        logger.error(f"Error retrieving sentences: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve sentences")


@app.get("/sentences/page/{page_number}")
async def get_page_sentences(page_number: int = Path(..., ge=1, description="Page number (starts from 1)")):
    """
    Get sentences for a specific page
    Args:
        page_number: The page number to retrieve (1-indexed)
    Returns: JSON object with page content
    """
    try:
        sentences_data = get_sentences()
        pages = sentences_data.get("pages", [])
        
        # Find the requested page
        page = next((p for p in pages if p["page"] == page_number), None)
        
        if page is None:
            raise HTTPException(
                status_code=404, 
                detail=f"Page {page_number} not found. Available pages: 1-{len(pages)}"
            )
        
        logger.info(f"Page {page_number} retrieved")
        return JSONResponse(content=page)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving page {page_number}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve page {page_number}")


@app.get("/audio/{language}/{sentence_id}/{audio_id}")
async def get_audio(
    language: str = Path(..., description="Language code (e.g., 'english', 'monpa')"),
    sentence_id: str = Path(..., description="Sentence identifier"),
    audio_id: str = Path(..., description="Audio identifier (word or 'full_sentence')")
):
    """
    Serve audio file for a specific word or sentence
    Args:
        language: Language code
        sentence_id: Sentence identifier
        audio_id: Word or 'full_sentence'
    Returns: Audio file
    """
    try:
        # Get audio file path
        audio_file = get_audio_file_path(language, sentence_id, audio_id)
        
        if audio_file is None:
            # Try fallback to full_sentence if word-level audio not found
            if audio_id != "full_sentence":
                logger.warning(f"Word audio not found: {language}/{sentence_id}/{audio_id}, trying full_sentence")
                audio_file = get_audio_file_path(language, sentence_id, "full_sentence")
            
            if audio_file is None:
                logger.error(f"Audio not found: {language}/{sentence_id}/{audio_id}")
                raise HTTPException(
                    status_code=404,
                    detail=f"Audio file not found for {language}/{sentence_id}/{audio_id}"
                )
        
        # Determine media type based on file extension
        media_types = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.m4a': 'audio/mp4'
        }
        media_type = media_types.get(audio_file.suffix, 'audio/mpeg')
        
        logger.info(f"Serving audio: {audio_file.name}")
        return FileResponse(
            path=str(audio_file),
            media_type=media_type,
            filename=audio_file.name
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving audio {language}/{sentence_id}/{audio_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to serve audio file")


@app.get("/images/{image_name}")
async def get_image(image_name: str = Path(..., description="Image filename")):
    """
    Serve image files
    Args:
        image_name: Name of the image file
    Returns: Image file
    """
    try:
        # Sanitize filename
        image_name = sanitize_filename(image_name)
        image_path = IMAGES_DIR / image_name
        
        # Check if file exists and is within IMAGES_DIR
        if not image_path.exists() or not image_path.is_file():
            logger.error(f"Image not found: {image_name}")
            raise HTTPException(status_code=404, detail=f"Image not found: {image_name}")
        
        # Security check
        if IMAGES_DIR not in image_path.parents and image_path.parent != IMAGES_DIR:
            logger.error(f"Unauthorized image access attempt: {image_name}")
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Determine media type
        media_types = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        }
        media_type = media_types.get(image_path.suffix.lower(), 'image/jpeg')
        
        logger.info(f"Serving image: {image_name}")
        return FileResponse(
            path=str(image_path),
            media_type=media_type,
            filename=image_name
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving image {image_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to serve image")


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "data_dir_exists": DATA_DIR.exists(),
        "assets_dir_exists": ASSETS_DIR.exists(),
        "images_dir_exists": IMAGES_DIR.exists()
    }


# Optional: Clear cache endpoint for development
@app.post("/admin/clear-cache")
async def clear_cache():
    """Clear cached JSON data (useful during development)"""
    global _languages_cache, _sentences_cache
    _languages_cache = None
    _sentences_cache = None
    logger.info("Cache cleared")
    return {"message": "Cache cleared successfully"}


if __name__ == "__main__":
    import uvicorn
    
    # Create necessary directories if they don't exist
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    
    logger.info("Starting Interactive Storybook API server...")
    logger.info(f"Base directory: {BASE_DIR}")
    logger.info(f"Data directory: {DATA_DIR}")
    logger.info(f"Assets directory: {ASSETS_DIR}")
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes (disable in production)
        log_level="info"
    )
