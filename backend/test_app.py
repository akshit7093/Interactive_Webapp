import streamlit as st
import requests
import json
from io import BytesIO
import base64

# Configuration
API_BASE_URL = "http://localhost:8000"

# Page configuration
st.set_page_config(
    page_title="Storybook API Tester",
    page_icon="📚",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
    <style>
    .stButton>button {
        width: 100%;
        background-color: #4CAF50;
        color: white;
    }
    .success-box {
        padding: 10px;
        background-color: #d4edda;
        border: 1px solid #c3e6cb;
        border-radius: 5px;
        color: #155724;
    }
    .error-box {
        padding: 10px;
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        border-radius: 5px;
        color: #721c24;
    }
    .info-box {
        padding: 10px;
        background-color: #d1ecf1;
        border: 1px solid #bee5eb;
        border-radius: 5px;
        color: #0c5460;
    }
    </style>
""", unsafe_allow_html=True)

# Title
st.title("📚 Interactive Storybook API Tester")
st.markdown("---")

# Sidebar for API status
with st.sidebar:
    st.header("API Status")
    
    if st.button("🔄 Check API Health"):
        try:
            response = requests.get(f"{API_BASE_URL}/health", timeout=5)
            if response.status_code == 200:
                health_data = response.json()
                st.markdown('<div class="success-box">✅ API is healthy</div>', unsafe_allow_html=True)
                st.json(health_data)
            else:
                st.markdown('<div class="error-box">❌ API returned error</div>', unsafe_allow_html=True)
        except requests.exceptions.ConnectionError:
            st.markdown('<div class="error-box">❌ Cannot connect to API. Make sure FastAPI is running on port 8000.</div>', unsafe_allow_html=True)
        except Exception as e:
            st.error(f"Error: {str(e)}")
    
    st.markdown("---")
    st.info(f"**API URL:** {API_BASE_URL}")
    st.markdown("""
    **Quick Start:**
    1. Run FastAPI: `python app.py`
    2. Test endpoints using this app
    3. Check audio/image serving
    """)

# Main content tabs
tab1, tab2, tab3, tab4, tab5 = st.tabs([
    "🌐 Languages", 
    "📄 Sentences", 
    "🎵 Audio", 
    "🖼️ Images",
    "🔧 Advanced"
])

# Tab 1: Languages Testing
with tab1:
    st.header("Test Languages Endpoint")
    st.markdown("Fetch available languages from the API")
    
    if st.button("Get Languages", key="get_languages"):
        try:
            response = requests.get(f"{API_BASE_URL}/languages")
            if response.status_code == 200:
                languages_data = response.json()
                st.success("✅ Languages retrieved successfully!")
                
                col1, col2 = st.columns(2)
                with col1:
                    st.subheader("Languages List")
                    for lang in languages_data.get("languages", []):
                        with st.expander(f"{lang['display_name']} ({lang['code']})"):
                            st.write(f"**Code:** {lang['code']}")
                            st.write(f"**Name:** {lang['name']}")
                            st.write(f"**Default:** {lang['default']}")
                
                with col2:
                    st.subheader("Raw JSON Response")
                    st.json(languages_data)
            else:
                st.error(f"❌ Error: {response.status_code}")
                st.text(response.text)
        except Exception as e:
            st.error(f"❌ Error: {str(e)}")

# Tab 2: Sentences Testing
with tab2:
    st.header("Test Sentences Endpoint")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Get All Sentences")
        if st.button("Fetch All Pages", key="get_all_sentences"):
            try:
                response = requests.get(f"{API_BASE_URL}/sentences")
                if response.status_code == 200:
                    sentences_data = response.json()
                    st.success("✅ All sentences retrieved!")
                    
                    # Display metadata
                    metadata = sentences_data.get("metadata", {})
                    st.info(f"**Total Pages:** {metadata.get('total_pages', 'N/A')}")
                    st.info(f"**Title:** {metadata.get('app_title', 'N/A')}")
                    
                    # Display pages
                    for page in sentences_data.get("pages", []):
                        with st.expander(f"📖 Page {page['page']} (Sticker: {page['sticker_number']})"):
                            st.write(f"**Image:** {page['image']}")
                            
                            for lang, sentences in page['sentences'].items():
                                st.write(f"**Language: {lang.upper()}**")
                                for sentence in sentences:
                                    st.text(f"  - [{sentence['speaker']}] {sentence['text']}")
                else:
                    st.error(f"❌ Error: {response.status_code}")
            except Exception as e:
                st.error(f"❌ Error: {str(e)}")
    
    with col2:
        st.subheader("Get Specific Page")
        page_number = st.number_input("Page Number", min_value=1, max_value=10, value=1, key="page_num")
        
        if st.button("Fetch Page", key="get_page"):
            try:
                response = requests.get(f"{API_BASE_URL}/sentences/page/{page_number}")
                if response.status_code == 200:
                    page_data = response.json()
                    st.success(f"✅ Page {page_number} retrieved!")
                    st.json(page_data)
                elif response.status_code == 404:
                    st.warning(f"⚠️ Page {page_number} not found")
                else:
                    st.error(f"❌ Error: {response.status_code}")
                    st.text(response.text)
            except Exception as e:
                st.error(f"❌ Error: {str(e)}")

# Tab 3: Audio Testing
with tab3:
    st.header("Test Audio Endpoint")
    st.markdown("Test audio file serving and playback")
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        language_audio = st.selectbox(
            "Language",
            ["english", "monpa"],
            key="audio_lang"
        )
        
        sentence_id_audio = st.selectbox(
            "Sentence ID",
            [
                "girl_intro_p1",
                "boy_intro_p1",
                "play_football",
                "globe",
                "arunachal",
                "girl_computer_p2",
                "boy_celebration_p2"
            ],
            key="audio_sentence"
        )
        
        if language_audio == "english":
            audio_id = st.selectbox(
                "Audio ID (Word or full_sentence)",
                ["my", "name", "is", "and", "i", "study", "in", "class", 
                 "come", "let", "us", "play", "football", "this", "a", "globe",
                 "look", "there", "arunachal", "pradesh", "on", "the",
                 "am", "using", "computer", "today", "we", "are", "celebrating",
                 "annual", "school", "day", "full_sentence"],
                key="audio_id"
            )
        else:
            audio_id = st.selectbox(
                "Audio ID",
                ["full_sentence"],
                key="audio_id_sher"
            )
    
    with col2:
        st.info(f"""
        **Testing:**
        - Language: {language_audio}
        - Sentence: {sentence_id_audio}
        - Audio: {audio_id}
        """)
    
    if st.button("🎵 Test Audio", key="test_audio"):
        try:
            audio_url = f"{API_BASE_URL}/audio/{language_audio}/{sentence_id_audio}/{audio_id}"
            st.info(f"Requesting: `{audio_url}`")
            
            response = requests.get(audio_url)
            
            if response.status_code == 200:
                st.success("✅ Audio file retrieved successfully!")
                
                # Display audio player
                audio_bytes = BytesIO(response.content)
                st.audio(audio_bytes, format='audio/mp3')
                
                # Show file info
                st.info(f"**Content Type:** {response.headers.get('content-type', 'N/A')}")
                st.info(f"**File Size:** {len(response.content)} bytes")
            elif response.status_code == 404:
                st.warning("⚠️ Audio file not found. Trying fallback to full_sentence...")
                
                # Try fallback
                if audio_id != "full_sentence":
                    fallback_url = f"{API_BASE_URL}/audio/{language_audio}/{sentence_id_audio}/full_sentence"
                    fallback_response = requests.get(fallback_url)
                    
                    if fallback_response.status_code == 200:
                        st.success("✅ Fallback audio retrieved!")
                        audio_bytes = BytesIO(fallback_response.content)
                        st.audio(audio_bytes, format='audio/mp3')
                    else:
                        st.error("❌ Fallback also failed")
            else:
                st.error(f"❌ Error: {response.status_code}")
                st.text(response.text)
                
        except Exception as e:
            st.error(f"❌ Error: {str(e)}")

# Tab 4: Images Testing
with tab4:
    st.header("Test Images Endpoint")
    
    image_name = st.selectbox(
        "Select Image",
        ["page1.jpg", "page2.jpg"],
        key="image_select"
    )
    
    if st.button("🖼️ Load Image", key="load_image"):
        try:
            image_url = f"{API_BASE_URL}/images/{image_name}"
            st.info(f"Requesting: `{image_url}`")
            
            response = requests.get(image_url)
            
            if response.status_code == 200:
                st.success("✅ Image retrieved successfully!")
                
                # Display image
                st.image(BytesIO(response.content), caption=image_name, use_column_width=True)
                
                # Show file info
                st.info(f"**Content Type:** {response.headers.get('content-type', 'N/A')}")
                st.info(f"**File Size:** {len(response.content)} bytes ({len(response.content)/1024:.2f} KB)")
            elif response.status_code == 404:
                st.error(f"❌ Image not found: {image_name}")
                st.info("Make sure the image exists in `backend/assets/images/` directory")
            else:
                st.error(f"❌ Error: {response.status_code}")
                st.text(response.text)
                
        except Exception as e:
            st.error(f"❌ Error: {str(e)}")

# Tab 5: Advanced Testing
with tab5:
    st.header("Advanced API Testing")
    
    st.subheader("1. Complete Workflow Test")
    if st.button("🚀 Run Complete Workflow", key="workflow"):
        progress_bar = st.progress(0)
        status_text = st.empty()
        
        workflow_results = {}
        
        # Test 1: Languages
        status_text.text("Testing languages endpoint...")
        try:
            response = requests.get(f"{API_BASE_URL}/languages")
            workflow_results["languages"] = response.status_code == 200
        except:
            workflow_results["languages"] = False
        progress_bar.progress(25)
        
        # Test 2: Sentences
        status_text.text("Testing sentences endpoint...")
        try:
            response = requests.get(f"{API_BASE_URL}/sentences")
            workflow_results["sentences"] = response.status_code == 200
        except:
            workflow_results["sentences"] = False
        progress_bar.progress(50)
        
        # Test 3: Audio
        status_text.text("Testing audio endpoint...")
        try:
            response = requests.get(f"{API_BASE_URL}/audio/english/globe/full_sentence")
            workflow_results["audio"] = response.status_code == 200
        except:
            workflow_results["audio"] = False
        progress_bar.progress(75)
        
        # Test 4: Images
        status_text.text("Testing images endpoint...")
        try:
            response = requests.get(f"{API_BASE_URL}/images/page1.jpg")
            workflow_results["images"] = response.status_code == 200
        except:
            workflow_results["images"] = False
        progress_bar.progress(100)
        
        status_text.text("Workflow complete!")
        
        # Display results
        st.subheader("Test Results")
        for test_name, result in workflow_results.items():
            if result:
                st.success(f"✅ {test_name.upper()}: Passed")
            else:
                st.error(f"❌ {test_name.upper()}: Failed")
    
    st.markdown("---")
    
    st.subheader("2. Custom API Request")
    custom_endpoint = st.text_input("Endpoint (e.g., /health)", value="/health")
    
    if st.button("Send Request", key="custom_request"):
        try:
            response = requests.get(f"{API_BASE_URL}{custom_endpoint}")
            st.write(f"**Status Code:** {response.status_code}")
            st.write("**Response:**")
            
            try:
                st.json(response.json())
            except:
                st.text(response.text)
        except Exception as e:
            st.error(f"❌ Error: {str(e)}")
    
    st.markdown("---")
    
    st.subheader("3. Clear API Cache")
    st.warning("⚠️ This will clear the API's cached JSON data")
    if st.button("Clear Cache", key="clear_cache"):
        try:
            response = requests.post(f"{API_BASE_URL}/admin/clear-cache")
            if response.status_code == 200:
                st.success("✅ Cache cleared successfully!")
                st.json(response.json())
            else:
                st.error(f"❌ Error: {response.status_code}")
        except Exception as e:
            st.error(f"❌ Error: {str(e)}")

# Footer
st.markdown("---")
st.markdown("""
<div style='text-align: center; color: #666;'>
    <p>Interactive Storybook API Tester v1.0</p>
    <p>Make sure FastAPI server is running on http://localhost:8000</p>
</div>
""", unsafe_allow_html=True)
