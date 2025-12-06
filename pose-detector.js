class PoseDetector {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.detector = null;
        this.modelLoaded = false;
        this.currentPoses = [];
        this.animationId = null;
        this.isStreaming = false;
        
        // Keypoint connections for drawing skeleton
        this.connections = [
            ['left_shoulder', 'right_shoulder'],
            ['left_shoulder', 'left_elbow'],
            ['left_elbow', 'left_wrist'],
            ['right_shoulder', 'right_elbow'],
            ['right_elbow', 'right_wrist'],
            ['left_shoulder', 'left_hip'],
            ['right_shoulder', 'right_hip'],
            ['left_hip', 'right_hip'],
            ['left_hip', 'left_knee'],
            ['left_knee', 'left_ankle'],
            ['right_hip', 'right_knee'],
            ['right_knee', 'right_ankle'],
            ['left_hip', 'left_knee'],
            ['left_knee', 'left_ankle'],
            ['right_hip', 'right_knee'],
            ['right_knee', 'right_ankle'],
            ['left_ankle', 'left_heel'],
            ['left_heel', 'left_foot_index'],
            ['right_ankle', 'right_heel'],
            ['right_heel', 'right_foot_index']
        ];
    }

    async initialize() {
        try {
            console.log('Loading pose detection model...');
            
            // Import the required modules
            const model = poseDetection.SupportedModels.MoveNet;
            
            // Use MoveNet which is more lightweight and reliable
            this.detector = await poseDetection.createDetector(model, {
                modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
                enableSmoothing: true,
                minPoseScore: 0.25
            });
            
            this.modelLoaded = true;
            console.log('Pose detection model loaded successfully');
            return true;
        } catch (error) {
            console.error('Error loading pose detection model:', error);
            throw error;
        }
    }

    async start() {
        if (!this.modelLoaded) {
            throw new Error('Model not loaded');
        }

        try {
            // Get camera stream
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user',
                    frameRate: { ideal: 30 }
                },
                audio: false
            });
            
            this.video.srcObject = stream;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play().then(() => {
                        // Set canvas dimensions to match video
                        this.canvas.width = this.video.videoWidth || 640;
                        this.canvas.height = this.video.videoHeight || 480;
                        this.isStreaming = true;
                        console.log('Video streaming started:', this.canvas.width, 'x', this.canvas.height);
                        resolve();
                    });
                };
            });
            
            // Start detection loop
            this.startDetection();
            return true;
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.isStreaming = false;
            throw error;
        }
    }

    async startDetection() {
        if (!this.isStreaming) {
            console.error('Cannot start detection: video not streaming');
            return;
        }

        const detectPose = async () => {
            if (!this.isStreaming || !this.detector) {
                return;
            }

            try {
                // Check if video has valid dimensions
                if (this.video.videoWidth === 0 || this.video.videoHeight === 0) {
                    console.warn('Video dimensions are zero, skipping detection');
                    this.animationId = requestAnimationFrame(detectPose);
                    return;
                }

                // Ensure canvas dimensions match video
                if (this.canvas.width !== this.video.videoWidth || 
                    this.canvas.height !== this.video.videoHeight) {
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                }

                // Detect poses
                this.currentPoses = await this.detector.estimatePoses(this.video, {
                    maxPoses: 1,
                    flipHorizontal: true
                });

                // Draw results
                this.draw();
            } catch (error) {
                console.error('Error detecting pose:', error);
                // Continue with next frame even if error occurs
            }

            // Continue detection loop
            this.animationId = requestAnimationFrame(detectPose);
        };

        // Start the detection loop
        detectPose();
    }

    draw() {
        if (!this.isStreaming) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw video frame
        this.ctx.save();
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(this.video, -this.canvas.width, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();

        if (!this.currentPoses || this.currentPoses.length === 0) return;

        const pose = this.currentPoses[0];
        const keypoints = pose.keypoints;

        // Draw skeleton if enabled
        if (document.getElementById('showSkeleton')?.checked !== false) {
            this.drawSkeleton(keypoints);
        }

        // Draw keypoints
        keypoints.forEach(keypoint => {
            if (keypoint.score > 0.2) { // Lower threshold for better visibility
                this.drawKeypoint(keypoint);
            }
        });
    }

    drawSkeleton(keypoints) {
        this.ctx.strokeStyle = '#4cc9f0';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        
        // Create a map of keypoints by name for easy access
        const keypointMap = {};
        keypoints.forEach(kp => {
            keypointMap[kp.name] = kp;
        });

        // Draw each connection
        this.connections.forEach(([startName, endName]) => {
            const startPoint = keypointMap[startName];
            const endPoint = keypointMap[endName];
            
            if (startPoint && endPoint && 
                startPoint.score > 0.2 && endPoint.score > 0.2) {
                // Flip x coordinate for mirror effect
                const startX = this.canvas.width - startPoint.x;
                const endX = this.canvas.width - endPoint.x;
                
                this.ctx.beginPath();
                this.ctx.moveTo(startX, startPoint.y);
                this.ctx.lineTo(endX, endPoint.y);
                this.ctx.stroke();
            }
        });
    }

    drawKeypoint(keypoint) {
        if (keypoint.score < 0.2) return;
        
        // Flip x coordinate for mirror effect
        const x = this.canvas.width - keypoint.x;
        const y = keypoint.y;
        
        // Draw keypoint circle
        this.ctx.beginPath();
    }
}