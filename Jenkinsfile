pipeline {
    agent any
    
    environment {
        // Define Docker images we'll use
        NODE_IMAGE = 'node:18-slim'
        SONAR_IMAGE = 'sonarsource/sonar-scanner-cli:latest'
        
        // Define your Docker Hub image name
        IMAGE_NAME = 'siku9786/mern-backend-app'
        IMAGE_TAG = "build-${env.BUILD_NUMBER}"
    }
    
    stages {
        // Stage 1: Get the code from GitHub
        stage('Checkout Code') {
            steps {
                git branch: 'stagging', 
                    url: 'https://github.com/sikander-riaz/mern-graphql-social-app'
            }
        }
        
        // Stage 2: Validate Dockerfile exists and is correct
        stage('Validate Dockerfile') {
            steps {
                script {
                    echo "Validating Dockerfile..."
                    sh '''
                        # Check if Dockerfile exists
                        if [ ! -f Dockerfile ]; then
                            echo "ERROR: Dockerfile not found!"
                            exit 1
                        fi
                        
                        # Check if Dockerfile is not empty
                        if [ ! -s Dockerfile ]; then
                            echo "ERROR: Dockerfile is empty!"
                            exit 1
                        fi
                        
                        echo "Dockerfile validation passed"
                    '''
                }
            }
        }
        
        // Stage 2: Install dependencies and run tests
        stage('Build & Test') {
            steps {
                script {
                    // Run commands inside a Node.js container
                    docker.image(NODE_IMAGE).inside {
                        sh 'npm install'
                        // sh 'npm test -- --coverage'
                    }
                }
            }
        }
        
        // Stage 3: Check code quality with SonarQube
        stage('Code Quality Check') {
            steps {
                script {
                    docker.image(SONAR_IMAGE).inside {
                        withSonarQubeEnv('sonarqube') {
                            withCredentials([string(credentialsId: 'gen-token', variable: 'SONAR_TOKEN')]) {
                                sh '''
                                    sonar-scanner \
                                      -Dsonar.projectKey=mern-graph \
                                      -Dsonar.sources=. \
                                      -Dsonar.host.url=${SONAR_HOST_URL} \
                                      -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info \
                                      -Dsonar.token=${SONAR_TOKEN}
                                '''
                            }
                        }
                    }
                }
            }
        }
        
        // Stage 4: Build Docker image
        stage('Build Docker Image') {
            steps {
                sh """
                    docker build -t ${IMAGE_NAME}:${IMAGE_TAG} -t ${IMAGE_NAME}:latest .
                """
            }
        }
        
        // Stage 5: Push image to Docker Hub
        stage('Push to Docker Hub') {
            steps {
                withCredentials([string(credentialsId: 'docker-hub-token', variable: 'DOCKER_TOKEN')]) {
                    sh '''
                        echo "${DOCKER_TOKEN}" | docker login -u siku9786 --password-stdin
                        docker push ${IMAGE_NAME}:${IMAGE_TAG}
                        docker push ${IMAGE_NAME}:latest
                        docker logout
                    '''
                }
            }
        }
    }
    
    post {
        // This runs after all stages complete
        always {
            echo "Cleaning up..."
            cleanWs()
            sh 'docker system prune -af || true'
        }
        success {
            echo "Pipeline completed successfully!"
            echo "Image: ${IMAGE_NAME}:${IMAGE_TAG}"
        }
        failure {
            echo "Pipeline failed. Check the logs above."
        }
    }
}