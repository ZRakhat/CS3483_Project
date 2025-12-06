# Body Position Trainer

A web-based application for real-time body position tracking and exercise form analysis using computer vision.

## Features

- Real-time pose detection using TensorFlow.js PoseNet
- Multiple exercise modes:
  - Squat form analysis
  - Push-up form analysis
  - Plank form analysis
  - Standing posture analysis
- Real-time visual feedback and corrections
- Performance metrics tracking
- Session history and progress tracking
- Calibration feature
- Export functionality

## Setup Instructions

1. **Clone or download the project files**

2. **Open in a modern web browser**
   - The app requires a browser with WebRTC support (Chrome, Firefox, Edge)
   - HTTPS is required for camera access (or use localhost)

3. **Alternative: Run with a local server**
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Node.js with http-server
   npx http-server
