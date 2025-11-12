pipeline {
  // agent any
  agent {
        docker {
            image 'docker:29.0.0-dind' // The Docker-in-Docker image
            
            // This 'privileged' flag is for THIS CONTAINER, not the host.
            // This is what allows the nested Docker daemon to run.
            args '-u root --privileged' 
            
            // This tells Jenkins to re-use the controller's workspace
            // so the agent can access your checkout (Dockerfile, source code)
            reuseNode true 
        }
    }
    
    stages {
        stage('Verify Isolated Docker') {
            steps {
                // These commands talk to the *nested* daemon
                sh 'docker --version'
                sh 'docker info'  // You'll see this is a clean, nested daemon
                sh 'docker ps'    // This will be empty (it can't see the host)
            }
        } }
  options {
    timestamps()
    skipDefaultCheckout(true)
    durabilityHint('MAX_SURVIVABILITY')
    timeout(time: 60, unit: 'MINUTES')
  }

  parameters {
    choice(name: 'GIT_BRANCH', choices: ['stagging','master'], description: 'Branch to build')
    string(name: 'GIT_URL', defaultValue: 'https://github.com/sikander-riaz/mern-graphql-social-app', description: 'Monorepo URL')
    string(name: 'DOCKER_IMAGE', defaultValue: 'siku9786/mern-backend-app', description: 'Docker image name (repo/image)')
    string(name: 'REMOTE_HOST', defaultValue: 'ubuntu@1.2.3.4', description: 'Remote SSH target (user@host)')
    string(name: 'REMOTE_DEPLOY_CMD', defaultValue: "docker pull ${params.DOCKER_IMAGE}:latest && docker rm -f app || true && docker run -d --name app -p 80:80 ${params.DOCKER_IMAGE}:latest", description: 'Remote deploy command')
    string(name: 'EMAIL_TO', defaultValue: 'devops@example.com', description: 'Email recipient for notifications')
  }

  environment {
    NODE_IMAGE = 'node:18-slim'
    SONAR_IMAGE = 'sonarsource/sonar-scanner-cli:latest'
    IMAGE_TAG = "build-${env.BUILD_NUMBER}"
    GIT_CREDENTIALS = 'git-credentials'
    REGISTRY_CREDENTIALS = 'docker-hub-token'
    REMOTE_SSH_CREDENTIALS = 'remote-ssh'
    SONAR_TOKEN_CRED = 'gen-token'
    SONAR_SERVER_NAME = 'sonarqube'
  }

  stages {

    stage('Checkout Backend') {
      steps {
        script {
          // Checkout backend repo directly to workspace root
          checkout([$class: 'GitSCM',
            branches: [[name: "*/${params.GIT_BRANCH}"]],
            doGenerateSubmoduleConfigurations: false,
            extensions: [],
            userRemoteConfigs: [[url: params.BACKEND_GIT_URL, credentialsId: env.GIT_CREDENTIALS]]
          ])
        }
      }
    }

    stage('Checkout Frontend (Optional)') {
      when {
        expression { params.FRONTEND_GIT_URL?.trim() }
      }
      steps {
        script {
          dir('client') {
            checkout([$class: 'GitSCM',
              branches: [[name: "*/${params.GIT_BRANCH}"]],
              doGenerateSubmoduleConfigurations: false,
              extensions: [],
              userRemoteConfigs: [[url: params.FRONTEND_GIT_URL, credentialsId: env.GIT_CREDENTIALS]]
            ])
          }
        }
      }
    }

    stage('Validate Dockerfile') {
      steps {
        dir('server') {
          sh '''
            set -eux
            if [ ! -f Dockerfile ]; then
              echo "ERROR: server/Dockerfile not found!"
              exit 1
            fi
            if [ ! -s Dockerfile ]; then
              echo "ERROR: server/Dockerfile is empty!"
              exit 1
            fi
            echo "Dockerfile validation passed"
          '''
        }
      }
    }

    stage('Build & Test') {
      steps {
        dir('server') {
          script {
            docker.image(env.NODE_IMAGE).inside {
              sh '''
                set -eux
                if [ -f package.json ]; then
                  npm ci
                  npm test --if-present
                else
                  echo "No package.json found; skipping npm steps"
                fi
              '''
            }
          }
        }
      }
    }

    stage('SonarQube Scan') {
      steps {
        script {
          docker.image(env.SONAR_IMAGE).inside {
            withSonarQubeEnv(env.SONAR_SERVER_NAME) {
              withCredentials([string(credentialsId: env.SONAR_TOKEN_CRED, variable: 'SONAR_TOKEN')]) {
                sh """
                  set -eux
                  sonar-scanner \
                    -Dsonar.projectKey=${env.JOB_NAME}-${env.BUILD_NUMBER} \
                    -Dsonar.sources=server${params.FRONTEND_GIT_URL?.trim() ? ",client" : ""} \
                    -Dsonar.host.url=${SONAR_HOST_URL} \
                    -Dsonar.login=${SONAR_TOKEN} \
                    -Dsonar.working.directory=.scannerwork
                """
              }
            }
          }
        }
      }
    }

    stage('Quality Gate') {
      steps {
        timeout(time: 10, unit: 'MINUTES') {
          script {
            def qg = waitForQualityGate()
            if (qg.status != 'OK') {
              error "Quality Gate check failed: ${qg.status}"
            } else {
              echo "Quality Gate passed: ${qg.status}"
            }
          }
        }
      }
    }

    stage('Docker Build & Push') {
      steps {
        script {
          docker.withRegistry('', env.REGISTRY_CREDENTIALS) {
            dir('server') {
              def img = docker.build("${params.DOCKER_IMAGE}:${env.IMAGE_TAG}", ".")
              img.push()
              sh "docker tag ${params.DOCKER_IMAGE}:${env.IMAGE_TAG} ${params.DOCKER_IMAGE}:latest || true"
              sh "docker push ${params.DOCKER_IMAGE}:latest || true"
            }
          }
        }
      }
    }

    stage('Remote Deploy') {
      steps {
        script {
          sshagent(credentials: [env.REMOTE_SSH_CREDENTIALS]) {
            sh """
              set -eux
              ssh -o StrictHostKeyChecking=no ${params.REMOTE_HOST} "export DOCKER_IMAGE='${params.DOCKER_IMAGE}'; ${params.REMOTE_DEPLOY_CMD}"
            """
          }
        }
      }
    }

  }

  post {
    success {
      script {
        emailext subject: "SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                 to: params.EMAIL_TO,
                 body: """Build Succeeded!
Job: ${env.JOB_NAME}
Build: ${env.BUILD_NUMBER}
Image: ${params.DOCKER_IMAGE}:${env.IMAGE_TAG}
URL: ${env.BUILD_URL}
"""
      }
    }
    failure {
      script {
        emailext subject: "FAILURE: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                 to: params.EMAIL_TO,
                 body: """Build FAILED.
Job: ${env.JOB_NAME}
Build: ${env.BUILD_NUMBER}
URL: ${env.BUILD_URL}
Check console output for details.
"""
      }
    }
    always {
      cleanWs()
      sh 'docker system prune -af || true'
    }
  }
}