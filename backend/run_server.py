"""Run FastAPI server with proper error handling."""
import uvicorn
import sys

if __name__ == "__main__":
    try:
        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=8002,
            reload=False,
            log_level="info",
        )
    except Exception as e:
        print(f"Server error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
