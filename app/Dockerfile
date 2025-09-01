# 1. Builder Stage: 소스코드를 빌드하는 단계
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# pnpm 설치
RUN npm install -g pnpm

# 의존성 파일만 먼저 복사
COPY package*.json ./

# 의존성 설치 (개발 의존성 포함)
RUN pnpm install

# 소스코드 및 설정 파일 복사
COPY . .

# 타입스크립트 코드 빌드 -> 이 단계에서 /usr/src/app/dist 생성
RUN pnpm build


# 2. Production Stage: 실제 앱을 실행하는 단계
FROM node:18-alpine

WORKDIR /usr/src/app

# pnpm 설치
RUN npm install -g pnpm

# 운영 의존성 파일만 복사
COPY package*.json ./

# 운영 의존성만 설치
RUN pnpm install --prod

# Builder 스테이지에서 빌드된 'dist' 폴더만 복사
COPY --from=builder /usr/src/app/dist ./dist

# 애플리케이션 실행
CMD ["pnpm", "start"]