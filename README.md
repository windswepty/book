# 📚 LibreFlow (모던 도서대여 서비스)

> **"지식의 흐름을 한곳에서"**  
> 회원가입부터 도서 대여, 반납, 관리자 모니터링까지 완벽하게 지원하는 서버리스 도서대여 웹 어플리케이션입니다.

---

## 🚀 프로젝트 소개
LibreFlow는 복잡한 백엔드 서버 구축 없이 **Supabase**의 강력한 Auth, DB, RPC 기능을 활용하여 순수 프론트엔드 환경(Vanilla JS)에서 안전하고 빠르게 동작하는 도서관 시스템을 구현한 프로젝트입니다.

---

## 🛠 기술 스택

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (No Framework)
- **Backend & DB**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (이메일/비밀번호 기반)
- **Design / UI**: Glassmorphism, CSS Variables 기반 다크/라이트 테마 전환

---

## ✨ 주요 기능

### 1. 🔐 회원 및 인증 시스템
- **회원가입 / 로그인 / 로그아웃**: Supabase Auth를 이용한 안전한 인증
- **닉네임 중복 체크**: DB 트리거 및 `profiles` 테이블을 통해 중복 닉네임 방지
- **아이디/비밀번호 찾기**: 
  - 닉네임으로 마스킹된 이메일 찾기 (RPC 함수 적용)
  - 이메일 인증을 통한 비밀번호 재설정
- **회원 정보 관리**: 비밀번호 변경 및 2차 확인(닉네임 입력)을 통한 안전한 회원 탈퇴

### 2. 📖 도서 대여 시스템
- **도서 검색 및 조회**: 실시간 검색 기능 (디바운싱 적용)
- **대여 및 반납 (트랜잭션 처리)**: 
  - 안전한 재고 차감/복구를 위해 Supabase RPC(Remote Procedure Call) 함수 사용
  - 연체 시 추가 대여 자동 차단
- **실시간 재고 동기화**: Supabase Realtime을 적용하여 누군가 책을 빌리면 모든 유저의 화면에서 재고가 실시간으로 변경

### 3. 🛡 관리자 및 보안 (RLS)
- **관리자 전용 패널**: `admin` 권한을 가진 유저에게만 노출되며, 전체 유저의 대여 현황 조회 및 강제 반납 처리 가능
- **Row Level Security (RLS)**: 유저 본인의 데이터만 열람 및 수정할 수 있도록 DB 레벨에서 강력하게 통제

---

## 📁 디렉토리 구조

```text
📦 프로젝트 루트
 ┣ 📜 index.html    # 메인 페이지 및 UI 구조 (모달, 섹션 포함)
 ┣ 📜 style.css     # 다크/라이트 테마 및 UI 스타일링 (글래스모피즘 적용)
 ┣ 📜 app.js        # Supabase API 통신 및 DOM 이벤트 처리
 ┣ 📜 schema.sql    # Supabase PostgreSQL 테이블, RLS 정책, 트리거, RPC 함수 정의
 ┗ 📜 README.md     # 프로젝트 설명서
```

---

## 💻 접속 및 실행 방법

본 프로젝트는 GitHub Pages를 통해 배포되어 있어, 별도의 설치나 로컬 서버 구동 없이 아래 링크를 통해 바로 접속 및 테스트가 가능합니다.

🔗 **서비스 바로가기**: [https://windswepty.github.io/book/](https://windswepty.github.io/book/)

---

## 💡 개발 포인트 (회고)
- **AI-Assisted Development**: "프롬프트 블루프린터" 기법을 활용하여 요구사항을 구체적으로 분리하고, 단계별로 AI 코딩 어시스턴트와 협업하며 개발 속도와 완성도를 높였습니다.
- **Backend-less Architecture**: 프레임워크와 별도의 백엔드 서버 없이도 Supabase의 RPC 함수와 RLS 정책만으로 복잡한 비즈니스 로직(재고 관리, 권한 제어)을 처리할 수 있음을 증명했습니다.
