pipeline {
  agent {
    docker {
      // Ubuntu-based DinD: More stable than Alpine, prevents 'IO Error' crashes
      image 'cruizba/ubuntu-dind:latest'
      args '--runtime=sysbox-runc'
      reuseNode true
    }
  }

  options {
    timestamps()
    skipDefaultCheckout(true)
    // Timeout if something hangs for too long
    timeout(time: 45, unit: 'MINUTES') 
  }

  parameters {
    choice(name: 'GIT_BRANCH', choices: ['stagging','master'], description: 'Branch to build')
    string(name: 'GIT_URL', defaultValue: 'https://github.com/sikander-riaz/mern-graphql-social-app', description: 'Repo URL')
    string(name: 'DOCKER_IMAGE', defaultValue: 'siku9786/mern-backend-app', description: 'Docker image (repo/name)')
    string(name: 'DOCKER_REGISTRY', defaultValue: '', description: 'Registry URL (empty for Docker Hub)')
    
    // MAKE SURE TO FILL THIS when building! (e.g. ubuntu@1.2.3.4)
    string(name: 'REMOTE_HOST', defaultValue: '', description: 'Target Server (user@ip)')
    string(name: 'REMOTE_DEPLOY_CMD', defaultValue: "docker pull ${params.DOCKER_IMAGE}:latest && docker rm -f app || true && docker run -d --name app -p 80:80 ${params.DOCKER_IMAGE}:latest", description: 'Deploy command')
    
    string(name: 'EMAIL_TO', defaultValue: 'sikander.riaz@corp.tkxel.com', description: 'Email')
    string(name: 'SONARQUBE_SERVER', defaultValue: 'sonarqube', description: 'Jenkins SonarQube server name')
    string(name: 'SONAR_PROJECT_KEY', defaultValue: 'mern-graph', description: 'SonarQube project key')
  }

  environment {
    IMAGE_TAG = "build-${env.BUILD_NUMBER}"
    GIT_CREDENTIALS = 'git-credentials'
    REGISTRY_CREDENTIALS = 'docker-hub-token'
    REMOTE_SSH_CREDENTIALS = 'remote-ssh'
    SONAR_TOKEN_ID = 'gen-token' 
  }

  stages {
    stage('Setup & Checkout') {
      steps {
        // Installing everything in one go to save time
        // Using apt (Ubuntu) instead of apk (Alpine) for stability
        sh '''
          apt-get update -qq
          apt-get install -y -qq git curl openjdk-11-jre unzip
          curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
          apt-get install -y -qq nodejs
        '''
        
        checkout([$class: 'GitSCM',
          branches: [[name: "*/${params.GIT_BRANCH}"]],
          userRemoteConfigs: [[url: params.GIT_URL, credentialsId: env.GIT_CREDENTIALS]]
        ])
      }
    }

    stage('Parallel Install & Test') {
      parallel {
        stage('Backend') {
          steps {
            dir('server') {
              sh '''
                if [ -f package.json ]; then
                  npm ci --prefer-offline --no-audit || npm install
                  npm test --if-present || true
                fi
              '''
            }
          }
        }
        stage('Frontend') {
          steps {
            dir('client') {
              sh '''
                if [ -f package.json ]; then
                  npm ci --prefer-offline --no-audit || npm install
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
           def scannerHome = tool name: 'scanner', type: 'hudson.plugins.sonar.SonarRunnerInstallation'
           withSonarQubeEnv(params.SONARQUBE_SERVER) {
             withCredentials([string(credentialsId: env.SONAR_TOKEN_ID, variable: 'SONAR_TOKEN')]) {
                // Added memory limit to prevent Java heap crashes
                sh """
                  export SONAR_SCANNER_OPTS="-Xmx1024m"
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
        timeout(time: 5, unit: 'MINUTES') {
          script {
            def qg = waitForQualityGate()
            if (qg.status != 'OK') {
              error "Quality Gate failed: ${qg.status}"
            }
          }
        }
      }
    }

    stage('Docker Build & Push') {
      when { expression { fileExists('server/Dockerfile') } }
      steps {
        script {
          docker.withRegistry(params.DOCKER_REGISTRY, env.REGISTRY_CREDENTIALS) {
            // Building specifically the server context
            def img = docker.build("${params.DOCKER_IMAGE}:${env.IMAGE_TAG}", "-f server/Dockerfile server")
            img.push()
            img.push('latest')
          }
        }
      }
    }

    stage('Remote Deploy') {
      // Only runs if you provided an IP address in the parameters
      when { expression { return params.REMOTE_HOST && params.REMOTE_HOST.trim() != '' } }
      steps {
        sshagent(credentials: [env.REMOTE_SSH_CREDENTIALS]) {
          sh """
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