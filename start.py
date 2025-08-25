# start.py — WebContainer-compatible version (Flask backend only)
import os
import sys

# Add backend directory to Python path
ROOT_DIR = os.path.abspath(os.path.dirname(__file__))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
sys.path.insert(0, BACKEND_DIR)

def main():
    # Configuration
    BACKEND_HOST = os.getenv("DEV_HOST", "0.0.0.0")  # Use 0.0.0.0 for WebContainer
    BACKEND_PORT = int(os.getenv("DEV_PORT", "5000"))
    
    print(f"[DEV] Starting Flask backend on {BACKEND_HOST}:{BACKEND_PORT}")
    print(f"[DEV] Frontend files are in: {os.path.join(ROOT_DIR, 'frontend')}")
    print(f"[DEV] Open frontend/index.html in Bolt's preview to access the application")
    
    # Import and run Flask app
    try:
        from app import app as flask_app
        flask_app.run(
            host=BACKEND_HOST, 
            port=BACKEND_PORT, 
            debug=True, 
            use_reloader=False,
            threaded=True
        )
    except Exception as e:
        print(f"Error starting Flask app: {e}")
        return 1

if __name__ == "__main__":
    main()