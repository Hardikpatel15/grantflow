import uvicorn
import os
import sys

def main():
    print("=" * 70)
    print("  🚀 Starting GrantFlow — University Research Grant & Audit Portal")
    print("=" * 70)
    print("\n  🌐 Web Application:       http://localhost:8000")
    print("  📖 Interactive API Docs:  http://localhost:8000/docs")
    print("  📊 Power BI Feed:         http://localhost:8000/api/analytics/powerbi-export")
    print("\n  👥 Pre-Configured Test Logins (Role-Based Access Control):")
    print("     1. Scholar:  scholar@university.edu  /  scholar123")
    print("     2. PI:       pi@university.edu       /  pi123")
    print("     3. Auditor:  auditor@university.edu  /  auditor123")
    print("     4. Dean:     dean@university.edu     /  dean123")
    print("\n  Press CTRL+C to stop the server.")
    print("=" * 70 + "\n")

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    main()
