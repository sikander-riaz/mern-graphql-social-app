pipeline {
  agent {
    docker {
      image 'docker:29.0.0-dind'
      args '--privileged -u root'
      reuseNode true
    }
  }

  options {
    timestamps()
    skipDefaultCheckout(true)
    durabilityHint('MAX_SURVIVABILITY')
    timeout(time: 60, unit: 'MINUTES')
  }

  parameters {
    choice(name: 'GIT_BRANCH', choices: ['stagging','master'], description: 'Branch to build')
    string(name: 'GIT_URL', defaultValue: 'https://github.com/sikander-riaz/mern-graphql-social-app', description: 'Repo URL')

    // Container registry
    string(name: 'DOCKER_IMAGE', defaultValue: 'siku9786/mern-backend-app', description: 'Docker image (repo/name)')
    string(name: 'DOCKER_REGISTRY', defaultValue: '', description: 'Registry URL (empty for Docker Hub)')

    // Deployment (optional for now)
    string(name: 'REMOTE_HOST', defaultValue: '', description: 'Remote SSH target (user@host). Leave empty to skip deploy')
    string(name: 'REMOTE_DEPLOY_CMD', defaultValue: "docker pull ${params.DOCKER_IMAGE}:latest && docker rm -f app || true && docker run -d --name app -p 80:80 ${params.DOCKER_IMAGE}:latest", description: 'Remote deploy command')

    // Notifications
    string(name: 'EMAIL_TO', defaultValue: 'devops@example.com', description: 'Email recipient')

    // SonarQube
    string(name: 'SONARQUBE_SERVER', defaultValue: 'sonarqube', description: 'Jenkins SonarQube server name')
    string(name: 'SONAR_SCANNER_TOOL', defaultValue: 'scanner', description: 'Jenkins SonarScanner tool name')
    string(name: 'SONAR_PROJECT_KEY', defaultValue: 'mern-graph', description: 'SonarQube project key')
  }

  environment {
    IMAGE_TAG = "build-${env.BUILD_NUMBER}"
    GIT_CREDENTIALS = 'git-credentials'
    REGISTRY_CREDENTIALS = 'docker-hub-token'
    REMOTE_SSH_CREDENTIALS = 'remote-ssh'

    NODE_IMAGE = 'node:18-slim'
  }

  stages {
    stage('Setup (git in DinD)') {
      steps {
        sh 'apk add --no-cache git openssh-client bash curl'
      }
    }

    stage('Checkout') {
      steps {
        checkout([$class: 'GitSCM',
          branches: [[name: "*/${params.GIT_BRANCH}"]],
          userRemoteConfigs: [[url: params.GIT_URL, credentialsId: env.GIT_CREDENTIALS]]
        ])
      }
    }

    stage('Build/Test (Node)') {
      steps {
        script {
          docker.image(env.NODE_IMAGE).inside {
            // Server
            dir('server') {
              sh '''
                set -eux
                if [ -f package.json ]; then
                  npm ci
                  npm test --if-present
                  npm run build --if-present
                fi
              '''
            }
            // Client
            dir('client') {
              sh '''
                set -eux
                if [ -f package.json ]; then
                  npm ci
                  npm test --if-present
                  npm run build --if-present
                fi
              '''
            }
          }
        }
      }
    }

    stage('SonarQube Scan') {
      steps {
        withSonarQubeEnv(params.SONARQUBE_SERVER) {
          script {
            def scannerHome = tool name: params.SONAR_SCANNER_TOOL, type: 'hudson.plugins.sonar.SonarRunnerInstallation'
            sh """
              set -eux
              ${scannerHome}/bin/sonar-scanner \
                -Dsonar.projectKey=${params.SONAR_PROJECT_KEY} \
                -Dsonar.sources=. \
                -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/build/**,**/.next/** \
                -Dsonar.javascript.lcov.reportPaths=server/coverage/lcov.info,client/coverage/lcov.info || true
            """
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
              error "Quality Gate failed: ${qg.status}"
            }
          }
        }
      }
    }

    stage('Docker Build and Push') {
      when { expression { fileExists('server/Dockerfile') } }
      steps {
        script {
          docker.withRegistry(params.DOCKER_REGISTRY, env.REGISTRY_CREDENTIALS) {
            def img = docker.build("${params.DOCKER_IMAGE}:${env.IMAGE_TAG}", "-f server/Dockerfile server")
            img.push()
            img.push('latest')
          }
        }
      }
    }

    stage('Remote Deploy') {
      when { expression { return params.REMOTE_HOST && params.REMOTE_HOST.trim() != '' } }
      steps {
        sshagent(credentials: [env.REMOTE_SSH_CREDENTIALS]) {
          sh """
            set -eux
            ssh -o StrictHostKeyChecking=no ${params.REMOTE_HOST} "export DOCKER_IMAGE='${params.DOCKER_IMAGE}'; ${params.REMOTE_DEPLOY_CMD}"
          """
        }
      }
    }
  }

  post {
    success {
      script {
        emailext subject: "SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                 to: params.EMAIL_TO,
                 body: """Build Succeeded!\nJob: ${env.JOB_NAME}\nBuild: ${env.BUILD_NUMBER}\nImage: ${params.DOCKER_IMAGE}:${env.IMAGE_TAG}\nURL: ${env.BUILD_URL}\n"""
      }
    }
    failure {
      script {
        emailext subject: "FAILURE: ${env.JOB_NAME} #${env.BUILD_NUMBER}",
                 to: params.EMAIL_TO,
                 body: """Build FAILED.\nJob: ${env.JOB_NAME}\nBuild: ${env.BUILD_NUMBER}\nURL: ${env.BUILD_URL}\nCheck console output for details.\n"""
      }
    }
    always {
      cleanWs()
      sh 'docker system prune -af || true'
    }
  }
}
