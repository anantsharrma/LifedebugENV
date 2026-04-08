import subprocess
import sys
import os

def main():
    """
    Entry point for the 'server' command.
    This script acts as a bridge to start the Node.js server which contains 
    the actual environment logic for LifeDebugEnv.
    """
    try:
        # Get the root directory (parent of the 'server' folder)
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        os.chdir(root_dir)
        
        print(f"Starting Node.js server from {root_dir}...")
        
        # Start the node server using npx tsx server.ts
        # This matches the command used in the Dockerfile
        subprocess.run(["npx", "tsx", "server.ts"], check=True)
    except KeyboardInterrupt:
        print("\nServer stopped by user.")
    except Exception as e:
        print(f"Error: Failed to start Node.js server: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
