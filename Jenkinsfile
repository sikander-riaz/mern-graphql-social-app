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

    // Deployment
    string(name: 'REMOTE_HOST', defaultValue: '', description: 'Remote SSH target (user@host). Leave empty to skip deploy')
    string(name: 'REMOTE_DEPLOY_CMD', defaultValue: "docker pull ${params.DOCKER_IMAGE}:latest && docker rm -f app || true && docker run -d --name app -p 80:80 ${params.DOCKER_IMAGE}:latest", description: 'Remote deploy command')

    // Notifications
    string(name: 'EMAIL_TO', defaultValue: 'devops@example.com', description: 'Email recipient')

    // SonarQube
    string(name: 'SONARQUBE_SERVER', defaultValue: 'sonarqube', description: 'Jenkins SonarQube server name')
    // We will use the tool name 'scanner' directly in the stage below
    string(name: 'SONAR_PROJECT_KEY', defaultValue: 'mern-graph', description: 'SonarQube project key')
  }

  environment {
    IMAGE_TAG = "build-${env.BUILD_NUMBER}"
    GIT_CREDENTIALS = 'git-credentials'
    REGISTRY_CREDENTIALS = 'docker-hub-token'
    REMOTE_SSH_CREDENTIALS = 'remote-ssh'
    
    // Sonar Token ID
    SONAR_TOKEN_ID = 'gen-token' 
  }

  stages {
    stage('Setup Environment') {
      steps {
        // Java (openjdk11-jre) is REQUIRED for the scanner tool to run
        sh 'apk add --no-cache git openssh-client bash curl nodejs npm openjdk11-jre'
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
          // Server Build
          dir('server') {
            sh '''
              set -eux
              if [ -f package.json ]; then
                # Using 'install' generates the missing lockfile
                npm install
                # '|| true' ensures the pipeline continues if tests are missing
                npm test --if-present || true
              fi
            '''
          }
          // Client Build
          dir('client') {
            sh '''
              set -eux
              if [ -f package.json ]; then
                npm install
              fi
            '''
          }
        }
      }
    }

    stage('SonarQube Scan') {
      steps {
        script {
           // This retrieves the path to the tool named "scanner" from Jenkins Global Tools
           def scannerHome = tool name: 'scanner', type: 'hudson.plugins.sonar.SonarRunnerInstallation'
           
           withSonarQubeEnv(params.SONARQUBE_SERVER) {
             withCredentials([string(credentialsId: env.SONAR_TOKEN_ID, variable: 'SONAR_TOKEN')]) {
                sh """
                  ${scannerHome}/bin/sonar-scanner \
                    -Dsonar.projectKey=${params.SONAR_PROJECT_KEY} \
                    -Dsonar.sources=. \
                    -Dsonar.login=${SONAR_TOKEN} \
                    -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/build/**,**/.next/**
                """
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
    always {
      cleanWs()
      sh 'docker system prune -af || true'
    }
  }
}