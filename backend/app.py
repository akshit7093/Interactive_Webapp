from fastapi import FastAPI, HTTPException, Path, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, HTMLResponse
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

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Base directory paths
BASE_DIR = PathLib(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
ASSETS_DIR = BASE_DIR / "assets"
IMAGES_DIR = ASSETS_DIR / "images"
VIDEOS_DIR = ASSETS_DIR / "videos"
FRONTEND_DIR = BASE_DIR.parent / "frontend"

# Cache for JSON files
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
    filename = os.path.basename(filename)
    filename = filename.replace("..", "").replace("/", "").replace("\\", "")
    return filename

def get_audio_file_path(language: str, sentence_id: str, audio_id: str) -> Optional[PathLib]:
    """Construct and validate audio file path"""
    language = sanitize_filename(language)
    sentence_id = sanitize_filename(sentence_id)
    audio_id = sanitize_filename(audio_id.lower())
    
    audio_base_path = ASSETS_DIR / language / "sentences" / sentence_id / "audio"
    extensions = ['.mp3', '.wav', '.ogg', '.m4a']
    
    for ext in extensions:
        audio_file = audio_base_path / f"{audio_id}{ext}"
        if audio_file.exists() and audio_file.is_file():
            if ASSETS_DIR in audio_file.parents:
                return audio_file
    return None

# FIXED: Correct path validation for videos
def get_video_file_path(video_name: str) -> Optional[PathLib]:
    """Construct and validate video file path"""
    video_name = sanitize_filename(video_name)
    video_path = VIDEOS_DIR / video_name
    
    # Check if file exists and is in the correct directory
    if video_path.exists() and video_path.is_file() and video_path.parent == VIDEOS_DIR:
        return video_path
    return None

# ============================================================================
# API ENDPOINTS
# ============================================================================
@app.get("/api")
async def api_root(request: Request):
    """API root endpoint with information"""
    origin = request.headers.get("origin")
    logger.info(f"API root accessed from origin: {origin}")
    return {
        "message": "Interactive Storybook API",
        "version": "1.0.0",
        "endpoints": {
            "languages": "/api/languages",
            "sentences": "/api/sentences",
            "page": "/api/sentences/page/{page_number}",
            "audio": "/api/audio/{language}/{sentence_id}/{audio_id}",
            "image": "/api/images/{image_name}",
            "video": "/api/videos/{video_name}"
        }
    }

@app.get("/api/languages")
async def get_languages_endpoint(request: Request):
    """Get list of available languages"""
    origin = request.headers.get("origin")
    logger.info(f"Languages endpoint accessed from origin: {origin}")
    try:
        languages_data = get_languages()
        return JSONResponse(content=languages_data)
    except Exception as e:
        logger.error(f"Error retrieving languages: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve languages")

@app.get("/api/sentences")
async def get_all_sentences(request: Request):
    """Get complete sentences configuration for all pages"""
    origin = request.headers.get("origin")
    logger.info(f"Sentences endpoint accessed from origin: {origin}")
    try:
        sentences_data = get_sentences()
        return JSONResponse(content=sentences_data)
    except Exception as e:
        logger.error(f"Error retrieving sentences: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve sentences")

@app.get("/api/sentences/page/{page_number}")
async def get_page_sentences(
    page_number: int = Path(..., ge=1),
    request: Request = None
):
    """Get sentences for a specific page"""
    origin = request.headers.get("origin") if request else "Unknown"
    logger.info(f"Page {page_number} endpoint accessed from origin: {origin}")
    try:
        sentences_data = get_sentences()
        pages = sentences_data.get("pages", [])
        page = next((p for p in pages if p["page"] == page_number), None)
        
        if page is None:
            raise HTTPException(
                status_code=404, 
                detail=f"Page {page_number} not found. Available pages: 1-{len(pages)}"
            )
        
        return JSONResponse(content=page)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving page {page_number}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to retrieve page {page_number}")

@app.get("/api/audio/{language}/{sentence_id}/{audio_id}")
async def get_audio(
    language: str = Path(...),
    sentence_id: str = Path(...),
    audio_id: str = Path(...),
    request: Request = None
):
    """Serve audio file for a specific word or sentence"""
    origin = request.headers.get("origin") if request else "Unknown"
    logger.info(f"Audio endpoint accessed from origin: {origin}")
    try:
        audio_file = get_audio_file_path(language, sentence_id, audio_id)
        
        if audio_file is None:
            if audio_id != "full_sentence":
                logger.warning(f"Word audio not found: {language}/{sentence_id}/{audio_id}, trying full_sentence")
                audio_file = get_audio_file_path(language, sentence_id, "full_sentence")
            
            if audio_file is None:
                logger.error(f"Audio not found: {language}/{sentence_id}/{audio_id}")
                raise HTTPException(
                    status_code=404,
                    detail=f"Audio file not found for {language}/{sentence_id}/{audio_id}"
                )
        
        media_types = {'.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4'}
        media_type = media_types.get(audio_file.suffix.lower(), 'audio/mpeg')
        
        logger.info(f"Serving audio: {audio_file.name}")
        return FileResponse(path=str(audio_file), media_type=media_type, filename=audio_file.name)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving audio {language}/{sentence_id}/{audio_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to serve audio file")

@app.get("/api/images/{image_name}")
async def get_image(image_name: str = Path(...), request: Request = None):
    """Serve image files"""
    origin = request.headers.get("origin") if request else "Unknown"
    logger.info(f"Image endpoint accessed from origin: {origin}")
    try:
        image_name = sanitize_filename(image_name)
        image_path = IMAGES_DIR / image_name
        
        if not image_path.exists() or not image_path.is_file():
            logger.error(f"Image not found: {image_name}")
            raise HTTPException(status_code=404, detail=f"Image not found: {image_name}")
        
        if IMAGES_DIR not in image_path.parents and image_path.parent != IMAGES_DIR:
            logger.error(f"Unauthorized image access attempt: {image_name}")
            raise HTTPException(status_code=403, detail="Access denied")
        
        media_types = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp'}
        media_type = media_types.get(image_path.suffix.lower(), 'image/jpeg')
        
        logger.info(f"Serving image: {image_name}")
        return FileResponse(path=str(image_path), media_type=media_type, filename=image_name)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving image {image_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to serve image")

# FIXED: Correct path validation and detailed logging
@app.get("/api/videos/{video_name}")
async def get_video(video_name: str = Path(...), request: Request = None):
    """Serve video files (animation videos for pages)"""
    origin = request.headers.get("origin") if request else "Unknown"
    logger.info(f"Video endpoint accessed from origin: {origin}")
    try:
        video_name = sanitize_filename(video_name)
        logger.info(f"Requesting video: {video_name}")
        
        video_path = get_video_file_path(video_name)
        
        if video_path is None:
            logger.error(f"Video not found at path: {VIDEOS_DIR / video_name}")
            raise HTTPException(status_code=404, detail=f"Video file not found: {video_name}")
        
        media_types = {
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.webm': 'video/webm',
            '.ogg': 'video/ogg',
            '.avi': 'video/x-msvideo',
            '.mkv': 'video/x-matroska'
        }
        media_type = media_types.get(video_path.suffix.lower(), 'video/mp4')
        
        logger.info(f"Serving video: {video_name} from {video_path}")
        return FileResponse(path=str(video_path), media_type=media_type, filename=video_name)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving video {video_name}: {e}")
        raise HTTPException(status_code=500, detail="Failed to serve video")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "data_dir_exists": DATA_DIR.exists(),
        "assets_dir_exists": ASSETS_DIR.exists(),
        "images_dir_exists": IMAGES_DIR.exists(),
        "videos_dir_exists": VIDEOS_DIR.exists(),
        "frontend_dir_exists": FRONTEND_DIR.exists()
    }

# ============================================================================
# FRONTEND ROUTES
# ============================================================================
@app.get("/", response_class=HTMLResponse)
async def serve_index():
    """Serve the main index.html file"""
    try:
        index_path = FRONTEND_DIR / "index.html"
        if not index_path.exists():
            raise HTTPException(status_code=404, detail="Frontend index.html not found")
        
        with open(index_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        return HTMLResponse(content=html_content)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving index.html: {e}")
        raise HTTPException(status_code=500, detail="Failed to serve index.html")

@app.get("/styles.css")
async def serve_css():
    try:
        css_path = FRONTEND_DIR / "styles.css"
        if not css_path.exists():
            raise HTTPException(status_code=404, detail="styles.css not found")
        return FileResponse(path=str(css_path), media_type="text/css", filename="styles.css")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving styles.css: {e}")
        raise HTTPException(status_code=500, detail="Failed to serve styles.css")

@app.get("/script.js")
async def serve_main_js():
    try:
        js_path = FRONTEND_DIR / "script.js"
        if not js_path.exists():
            raise HTTPException(status_code=404, detail="script.js not found")
        return FileResponse(path=str(js_path), media_type="application/javascript", filename="script.js")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving script.js: {e}")
        raise HTTPException(status_code=500, detail="Failed to serve script.js")

@app.get("/config.js")
async def serve_config_js():
    try:
        js_path = FRONTEND_DIR / "config.js"
        if not js_path.exists():
            logger.warning(f"config.js not found at {js_path}, returning empty config")
            return HTMLResponse(content="// Config file not found\nconst API_BASE_URL = '';", media_type="application/javascript")
        return FileResponse(path=str(js_path), media_type="application/javascript", filename="config.js")
    except Exception as e:
        logger.error(f"Error serving config.js: {e}")
        return HTMLResponse(content="// Config file not found\nconst API_BASE_URL = '';", media_type="application/javascript")

@app.get("/utils.js")
async def serve_utils_js():
    try:
        js_path = FRONTEND_DIR / "utils.js"
        if not js_path.exists():
            return HTMLResponse(content="// Utils file not found", media_type="application/javascript")
        return FileResponse(path=str(js_path), media_type="application/javascript", filename="utils.js")
    except Exception as e:
        logger.error(f"Error serving utils.js: {e}")
        return HTMLResponse(content="// Utils file not found", media_type="application/javascript")

@app.get("/{filename}")
async def serve_frontend_file(filename: str):
    """Serve any other frontend files (fallback route)"""
    try:
        filename = sanitize_filename(filename)
        file_path = FRONTEND_DIR / filename
        
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail=f"File not found: {filename}")
        
        if FRONTEND_DIR not in file_path.parents and file_path.parent != FRONTEND_DIR:
            raise HTTPException(status_code=403, detail="Access denied")
        
        media_types = {'.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm'}
        media_type = media_types.get(file_path.suffix.lower(), 'application/octet-stream')
        
        return FileResponse(path=str(file_path), media_type=media_type, filename=filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving frontend file {filename}: {e}")
        raise HTTPException(status_code=500, detail="Failed to serve file")

if __name__ == "__main__":
    import uvicorn
    
    # Create necessary directories
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
    
    logger.info("Starting Interactive Storybook API server...")
    logger.info(f"Base directory: {BASE_DIR}")
    logger.info(f"Data directory: {DATA_DIR}")
    logger.info(f"Assets directory: {ASSETS_DIR}")
    logger.info(f"Videos directory: {VIDEOS_DIR}")
    logger.info(f"Frontend directory: {FRONTEND_DIR}")
    
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )