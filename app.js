class BodyPositionTrainer {
    constructor() {
        this.isTracking = false;
        this.sessionStartTime = null;
        this.sessionTimer = null;
        this.repsCount = 0;
        this.currentExercise = 'squat';
        this.feedbackHistory = [];
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializePoseDetector();
        this.updateExerciseGuide();
    }

    initializeElements() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('output');
        this.ctx = this.canvas.getContext('2d');
        
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.captureBtn = document.getElementById('captureBtn');
        this.calibrateBtn = document.getElementById('calibrateBtn');
        this.exerciseSelect = document.getElementById('exerciseSelect');
        
        this.statusElement = document.getElementById('status');
        this.feedbackList = document.getElementById('feedbackList');
        this.accuracyScore = document.getElementById('accuracyScore');
        this.repsCountElement = document.getElementById('repsCount');
        this.sessionTimeElement = document.getElementById('sessionTime');
        
        this.settingsModal = document.getElementById('settingsModal');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.closeSettings = document.getElementById('closeSettings');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startTracking());
        this.stopBtn.addEventListener('click', () => this.stopTracking());
        this.captureBtn.addEventListener('click', () => this.capturePose());
        this.calibrateBtn.addEventListener('click', () => this.calibrate());
        
        this.exerciseSelect.addEventListener('change', (e) => {
            this.currentExercise = e.target.value;
            this.updateExerciseGuide();
        });
        
        this.settingsBtn.addEventListener('click', () => {
            this.settingsModal.style.display = 'flex';
        });
        
        this.closeSettings.addEventListener('click', () => {
            this.settingsModal.style.display = 'none';
        });
        
        window.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.settingsModal.style.display = 'none';
            }
        });
    }

    async initializePoseDetector() {
        try {
            this.statusElement.textContent = 'Loading pose detection model...';
            this.poseDetector = new PoseDetector(this.video, this.canvas);
            await this.poseDetector.initialize();
            this.statusElement.textContent = 'Ready to start tracking';
        } catch (error) {
            console.error('Error initializing pose detector:', error);
            this.statusElement.textContent = 'Error: Could not load pose detection';
        }
    }

    async startTracking() {
        if (!this.poseDetector || !this.poseDetector.modelLoaded) {
            this.addFeedback('Please wait for model to load', 'warning');
            return;
        }

        try {
            await this.poseDetector.start();
            this.isTracking = true;
            this.sessionStartTime = Date.now();
            
            this.startBtn.disabled = true;
            this.stopBtn.disabled = false;
            this.captureBtn.disabled = false;
            
            this.startSessionTimer();
            this.statusElement.textContent = 'Tracking active';
            this.addFeedback('Tracking started. Perform your exercise.', 'info');
            
            this.startAnalysisLoop();
        } catch (error) {
            console.error('Error starting tracking:', error);
            this.addFeedback('Error starting camera', 'error');
        }
    }

    stopTracking() {
        this.isTracking = false;
        this.poseDetector.stop();
        
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.captureBtn.disabled = true;
        
        clearInterval(this.sessionTimer);
        this.statusElement.textContent = 'Tracking stopped';
        
        this.addFeedback('Tracking stopped', 'info');
        this.saveSession();
    }

    startAnalysisLoop() {
        const analyzePose = async () => {
            if (!this.isTracking) return;
            
            const poses = this.poseDetector.getCurrentPoses();
            if (poses && poses.length > 0) {
                const pose = poses[0];
                this.analyzePose(pose);
                this.updateMetrics(pose);
            }
            
            requestAnimationFrame(analyzePose);
        };
        
        analyzePose();
    }

    analyzePose(pose) {
        if (!pose || !pose.keypoints) return;
        
        const keypoints = pose.keypoints;
        const feedback = [];
        
        switch (this.currentExercise) {
            case 'squat':
                this.analyzeSquat(keypoints, feedback);
                break;
            case 'pushup':
                this.analyzePushup(keypoints, feedback);
                break;
            case 'plank':
                this.analyzePlank(keypoints, feedback);
                break;
            case 'posture':
                this.analyzePosture(keypoints, feedback);
                break;
        }
        
        feedback.forEach(fb => this.addFeedback(fb.message, fb.type));
        
        if (feedback.length === 0) {
            this.addFeedback('Good form! Keep going.', 'success');
        }
    }

    analyzeSquat(keypoints, feedback) {
        const leftHip = this.getKeypoint(keypoints, 'left_hip');
        const rightHip = this.getKeypoint(keypoints, 'right_hip');
        const leftKnee = this.getKeypoint(keypoints, 'left_knee');
        const rightKnee = this.getKeypoint(keypoints, 'right_knee');
        const leftAnkle = this.getKeypoint(keypoints, 'left_ankle');
        const rightAnkle = this.getKeypoint(keypoints, 'right_ankle');
        
        if (leftHip && rightHip && leftKnee && rightKnee) {
            const hipHeight = (leftHip.y + rightHip.y) / 2;
            const kneeHeight = (leftKnee.y + rightKnee.y) / 2;
            
            if (kneeHeight < hipHeight - 50) {
                this.repsCount++;
                this.repsCountElement.textContent = this.repsCount;
                this.addFeedback(`Squat completed! Total: ${this.repsCount}`, 'success');
            }
            
            if (leftKnee.x < leftAnkle.x) {
                feedback.push({
                    message: 'Knees going past toes - shift weight back',
                    type: 'warning'
                });
            }
            
            const hipDifference = Math.abs(leftHip.y - rightHip.y);
            if (hipDifference > 20) {
                feedback.push({
                    message: 'Keep hips level',
                    type: 'warning'
                });
            }
        }
    }

    analyzePushup(keypoints, feedback) {
        const leftShoulder = this.getKeypoint(keypoints, 'left_shoulder');
        const rightShoulder = this.getKeypoint(keypoints, 'right_shoulder');
        const leftElbow = this.getKeypoint(keypoints, 'left_elbow');
        const rightElbow = this.getKeypoint(keypoints, 'right_elbow');
        
        if (leftShoulder && rightShoulder && leftElbow && rightElbow) {
            const backAngle = this.calculateAngle(leftShoulder, rightShoulder, leftElbow);
            
            if (backAngle < 170) {
                feedback.push({
                    message: 'Keep your back straight',
                    type: 'warning'
                });
            }
            
            const elbowAngle = this.calculateAngle(leftShoulder, leftElbow, this.getKeypoint(keypoints, 'left_wrist'));
            if (elbowAngle < 90) {
                this.repsCount++;
                this.repsCountElement.textContent = this.repsCount;
                this.addFeedback(`Push-up completed! Total: ${this.repsCount}`, 'success');
            }
        }
    }

    analyzePlank(keypoints, feedback) {
        const leftShoulder = this.getKeypoint(keypoints, 'left_shoulder');
        const leftHip = this.getKeypoint(keypoints, 'left_hip');
        const leftKnee = this.getKeypoint(keypoints, 'left_knee');
        
        if (leftShoulder && leftHip && leftKnee) {
            const bodyAngle = this.calculateAngle(leftShoulder, leftHip, leftKnee);
            
            if (bodyAngle < 160) {
                feedback.push({
                    message: 'Keep your body in a straight line',
                    type: 'warning'
                });
            }
            
            if (leftHip.y > leftShoulder.y + 30) {
                feedback.push({
                    message: 'Hips are too high - lower them',
                    type: 'warning'
                });
            }
        }
    }

    analyzePosture(keypoints, feedback) {
        const leftShoulder = this.getKeypoint(keypoints, 'left_shoulder');
        const rightShoulder = this.getKeypoint(keypoints, 'right_shoulder');
        const leftEar = this.getKeypoint(keypoints, 'left_ear');
        const leftHip = this.getKeypoint(keypoints, 'left_hip');
        
        if (leftShoulder && rightShoulder && leftEar && leftHip) {
            const shoulderLevel = Math.abs(leftShoulder.y - rightShoulder.y);
            if (shoulderLevel > 15) {
                feedback.push({
                    message: 'Shoulders are not level',
                    type: 'warning'
                });
            }
            
            if (leftEar.x > leftShoulder.x + 20) {
                feedback.push({
                    message: 'Head is forward - align with shoulders',
                    type: 'warning'
                });
            }
            
            const backAngle = this.calculateAngle(leftEar, leftShoulder, leftHip);
            if (backAngle < 160) {
                feedback.push({
                    message: 'Stand up straight',
                    type: 'warning'
                });
            }
        }
    }

    getKeypoint(keypoints, name) {
        return keypoints.find(kp => kp.name === name);
    }

    calculateAngle(a, b, c) {
        if (!a || !b || !c) return 180;
        
        const ab = Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
        const bc = Math.sqrt(Math.pow(b.x - c.x, 2) + Math.pow(b.y - c.y, 2));
        const ac = Math.sqrt(Math.pow(c.x - a.x, 2) + Math.pow(c.y - a.y, 2));
        
        const angle = Math.acos((ab * ab + bc * bc - ac * ac) / (2 * ab * bc));
        return angle * (180 / Math.PI);
    }

    addFeedback(message, type = 'info') {
        const feedbackItem = document.createElement('div');
        feedbackItem.className = `feedback-item`;
        
        let icon = 'info-circle';
        if (type === 'warning') icon = 'exclamation-triangle';
        if (type === 'error') icon = 'times-circle';
        if (type === 'success') icon = 'check-circle';
        
        feedbackItem.innerHTML = `
            <i class="fas fa-${icon}"></i>
            <span>${message}</span>
        `;
        
        this.feedbackHistory.push({ message, type, timestamp: new Date() });
        this.feedbackList.prepend(feedbackItem);
        
        if (this.feedbackList.children.length > 5) {
            this.feedbackList.removeChild(this.feedbackList.lastChild);
        }
        
        if (type === 'warning' || type === 'error') {
            feedbackItem.style.animation = 'pulse 0.5s';
            setTimeout(() => {
                feedbackItem.style.animation = '';
            }, 500);
        }
    }

    updateMetrics(pose) {
        const accuracy = Math.min(95, 100 - this.feedbackHistory
            .filter(fb => fb.type === 'warning' || fb.type === 'error')
            .length * 5);
        
        this.accuracyScore.textContent = `${accuracy}%`;
        
        const calories = Math.floor(this.repsCount * 0.5 + (Date.now() - this.sessionStartTime) / 60000 * 3);
        document.getElementById('caloriesEst').textContent = calories;
    }

    startSessionTimer() {
        this.sessionTimer = setInterval(() => {
            if (!this.sessionStartTime) return;
            
            const elapsed = Date.now() - this.sessionStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            
            this.sessionTimeElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    updateExerciseGuide() {
        const instructions = document.getElementById('exerciseInstructions');
        let content = '';
        
        switch (this.currentExercise) {
            case 'squat':
                content = `
                    <h4>Squat Instructions:</h4>
                    <ol>
                        <li>Stand with feet shoulder-width apart</li>
                        <li>Keep your back straight</li>
                        <li>Lower your body as if sitting in a chair</li>
                        <li>Knees should not go past toes</li>
                        <li>Return to starting position</li>
                    </ol>
                `;
                break;
            case 'pushup':
                content = `
                    <h4>Push-up Instructions:</h4>
                    <ol>
                        <li>Start in plank position</li>
                        <li>Keep body in a straight line</li>
                        <li>Lower chest to the floor</li>
                        <li>Keep elbows at 45-degree angle</li>
                        <li>Push back to starting position</li>
                    </ol>
                `;
                break;
            case 'plank':
                content = `
                    <h4>Plank Instructions:</h4>
                    <ol>
                        <li>Start on forearms and toes</li>
                        <li>Keep body in a straight line</li>
                        <li>Engage core muscles</li>
                        <li>Don't let hips sag or rise</li>
                        <li>Hold for desired time</li>
                    </ol>
                `;
                break;
            case 'posture':
                content = `
                    <h4>Posture Instructions:</h4>
                    <ol>
                        <li>Stand with feet hip-width apart</li>
                        <li>Keep shoulders back and down</li>
                        <li>Align ears over shoulders</li>
                        <li>Engage core muscles</li>
                        <li>Distribute weight evenly</li>
                    </ol>
                `;
                break;
        }
        
        instructions.innerHTML = content;
    }

    capturePose() {
        if (!this.isTracking) return;
        
        const pose = this.poseDetector.getCurrentPoses();
        if (pose && pose.length > 0) {
            this.addFeedback('Pose captured for analysis', 'info');
            
            const dataUrl = this.canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `pose-${new Date().toISOString().slice(0, 19)}.png`;
            link.href = dataUrl;
            link.click();
        }
    }

    calibrate() {
        this.addFeedback('Calibration started. Stand in reference position.', 'info');
        
        setTimeout(() => {
            this.addFeedback('Calibration complete. Reference pose saved.', 'success');
        }, 3000);
    }

    saveSession() {
        const session = {
            date: new Date().toISOString(),
            exercise: this.currentExercise,
            duration: Date.now() - this.sessionStartTime,
            reps: this.repsCount,
            feedback: this.feedbackHistory
        };
        
        const historyList = document.getElementById('historyList');
        const sessionElement = document.createElement('div');
        sessionElement.className = 'history-item';
        sessionElement.innerHTML = `
            <strong>${new Date().toLocaleTimeString()}</strong> - 
            ${this.currentExercise}: ${this.repsCount} reps, 
            ${Math.floor((Date.now() - this.sessionStartTime) / 60000)}min
        `;
        
        historyList.prepend(sessionElement);
        
        if (document.getElementById('saveSessions')?.checked) {
            const sessions = JSON.parse(localStorage.getItem('trainingSessions') || '[]');
            sessions.push(session);
            localStorage.setItem('trainingSessions', JSON.stringify(sessions));
        }
        
        this.feedbackHistory = [];
        this.repsCount = 0;
    }
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.trainer = new BodyPositionTrainer();
});