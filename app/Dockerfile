# 1. Builder Stage: 소스코드를 빌드하는 단계
FROM node:18-alpine AS builder

WORKDIR /usr/src/app

# pnpm 설치
RUN npm install -g pnpm

# 의존성 설치
COPY package*.json ./
RUN pnpm install

# 소스코드 복사 및 빌드
COPY . .
RUN pnpm build # 이 명령어가 'dist' 폴더를 생성합니다.


# 2. Production Stage: 실제 앱을 실행하는 단계
FROM node:18-alpine

WORKDIR /usr/src/app

# pnpm 설치
RUN npm install -g pnpm

# 오직 운영에 필요한 의존성만 설치
COPY package*.json ./
RUN pnpm install --prod

# Builder 스테이지에서 빌드된 'dist' 폴더만 복사
COPY --from=builder /usr/src/app/dist ./dist

# 애플리케이션 실행
CMD ["pnpm", "start"]