# --- 1. Builder Stage: 의존성 설치 및 소스 코드 빌드 ---
    FROM node:18-alpine AS builder
    WORKDIR /usr/src/app
    
    # pnpm 설치
    RUN npm install -g pnpm
    
    # package.json과 tsconfig.json을 먼저 복사
    COPY package*.json ./
    COPY tsconfig.json ./
    
    # 의존성 설치 (개발 의존성 포함)
    RUN pnpm install
    
    # 나머지 모든 소스 코드 복사
    COPY ./src ./src
    
    # TypeScript 컴파일
    RUN pnpm build
    
    
    # --- 2. Production Stage: 실행에 필요한 파일만 복사 ---
    FROM node:18-alpine
    WORKDIR /usr/src/app
    
    # pnpm 설치
    RUN npm install -g pnpm
    
    # 프로덕션용 의존성만 복사
    COPY package*.json ./
    RUN pnpm install --prod
    
    # Builder 스테이지에서 컴파일된 dist 폴더를 복사
    COPY --from=builder /usr/src/app/dist ./dist
    
    # .env 파일을 사용하기 위해 dotenv를 설치했지만, Docker 환경에서는 환경 변수를 직접 주입하는 것이 더 좋음
    # COPY .env ./
    
    # 서버 실행
    CMD [ "node", "dist/server.js" ]