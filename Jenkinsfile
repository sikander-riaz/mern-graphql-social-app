pipeline {
//   agent  { label 'docker-node' }
 agent any
  options {
    timestamps()
  
    skipDefaultCheckout(true)
    durabilityHint('MAX_SURVIVABILITY')
    timeout(time: 60, unit: 'MINUTES')
  }

  parameters {
    choice(name: 'GIT_BRANCH', choices: ['stagging','master'], description: 'Branch to build')
    string(name: 'BACKEND_GIT_URL', defaultValue: 'https://github.com/sikander-riaz/mern-graphql-social-app', description: 'Backend repo URL')
    string(name: 'FRONTEND_GIT_URL', defaultValue: '', description: 'Frontend repo URL (optional)')
    string(name: 'DOCKER_IMAGE', defaultValue: 'siku9786/mern-backend-app', description: 'Docker image name (repo/image)')
    string(name: 'REMOTE_HOST', defaultValue: 'ubuntu@1.2.3.4', description: 'Remote SSH target (user@host)')
    string(name: 'REMOTE_DEPLOY_CMD', defaultValue: "docker pull ${params.DOCKER_IMAGE}:latest && docker rm -f app || true && docker run -d --name app -p 80:80 ${params.DOCKER_IMAGE}:latest", description: 'Remote deploy command')
    string(name: 'EMAIL_TO', defaultValue: 'devops@example.com', description: 'Email recipient for notifications')
  }

  environment {
    NODE_IMAGE = 'node:18-slim'
    SONAR_IMAGE = 'sonarsource/sonar-scanner-cli:latest'
    IMAGE_TAG = "build-${env.BUILD_NUMBER}"
    GIT_CREDENTIALS = 'git-credentials'          // matches your listed git credential
    REGISTRY_CREDENTIALS = 'docker-hub-token'   // Docker Hub token
    REMOTE_SSH_CREDENTIALS = 'remote-ssh'       // placeholder for SSH key credential
    SONAR_TOKEN_CRED = 'gen-token'              // Sonar token secret text
    SONAR_SERVER_NAME = 'sonarqube'             // Sonar server configured in Jenkins
  }

  stages {

    stage('Checkout Multiple SCMs') {
      steps {
        script {
          // backend
          dir('backend') {
            checkout([$class: 'GitSCM',
              branches: [[name: "*/${params.GIT_BRANCH}"]],
              doGenerateSubmoduleConfigurations: false,
              extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: '.']],
              userRemoteConfigs: [[url: params.BACKEND_GIT_URL, credentialsId: env.GIT_CREDENTIALS]]
            ])
          }

          // frontend (optional)
          if (params.FRONTEND_GIT_URL?.trim()) {
            dir('frontend') {
              checkout([$class: 'GitSCM',
                branches: [[name: "*/${params.GIT_BRANCH}"]],
                doGenerateSubmoduleConfigurations: false,
                extensions: [[$class: 'RelativeTargetDirectory', relativeTargetDir: '.']],
                userRemoteConfigs: [[url: params.FRONTEND_GIT_URL, credentialsId: env.GIT_CREDENTIALS]]
              ])
            }
          } else {
            echo "No frontend repo provided; skipping frontend checkout."
          }
        }
      }
    }

    stage('Validate Dockerfile (server)') {
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

    stage('Build & Test (server)') {
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
                    -Dsonar.sources=backend${params.FRONTEND_GIT_URL?.trim() ? ",frontend" : ""} \
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
            dir('backend') {
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
