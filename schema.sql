-- ==========================================
-- 1. 사용자 프로필 테이블 & 트리거 (인증 단계)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    nickname TEXT,
    avatar_url TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')), -- 역할 추가
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to profiles"
    ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Allow individual update access to own profile"
    ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_nickname TEXT;
BEGIN
    v_nickname := COALESCE(NEW.raw_user_meta_data->>'nickname', SPLIT_PART(NEW.email, '@', 1));
    
    -- 닉네임 중복 검사
    IF EXISTS (SELECT 1 FROM public.profiles WHERE nickname = v_nickname) THEN
        RAISE EXCEPTION '이미 사용 중인 닉네임입니다. 다른 닉네임을 선택해 주세요.';
    END IF;

    INSERT INTO public.profiles (id, email, nickname, avatar_url, role)
    VALUES (
        NEW.id,
        NEW.email,
        v_nickname,
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
        COALESCE(NEW.raw_user_meta_data->>'role', 'member')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ==========================================
-- 2. 도서(books) 테이블 생성 및 RLS 설정
-- ==========================================

CREATE TABLE IF NOT EXISTS public.books (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT,
    cover_url TEXT,
    total_copies INTEGER NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
    available_copies INTEGER NOT NULL DEFAULT 1 CHECK (available_copies >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to books"
    ON public.books FOR SELECT USING (true);


-- ==========================================
-- 3. 대여(rentals) 테이블 생성 및 RLS 설정
-- ==========================================

CREATE TABLE IF NOT EXISTS public.rentals (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    book_id BIGINT REFERENCES public.books(id) ON DELETE CASCADE NOT NULL,
    rented_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    due_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '14 days') NOT NULL,
    returned_at TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'rented' CHECK (status IN ('rented', 'returned', 'overdue'))
);

ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to read own rentals"
    ON public.rentals FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow users to insert own rentals"
    ON public.rentals FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update own rentals"
    ON public.rentals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow admins to read all rentals"
    ON public.rentals FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Allow admins to update all rentals"
    ON public.rentals FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));


-- ==========================================
-- 4. 안전한 대여/반납 트랜잭션 함수(RPC) 정의
-- ==========================================

CREATE OR REPLACE FUNCTION public.rent_book(p_book_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    v_available_copies INTEGER;
    v_user_id UUID;
    v_already_rented BOOLEAN;
    v_has_overdue BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '인증되지 않은 사용자입니다.';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.rentals
        WHERE user_id = v_user_id AND (status = 'overdue' OR (status = 'rented' AND due_at < now()))
    ) INTO v_has_overdue;

    IF v_has_overdue THEN
        RAISE EXCEPTION '연체된 도서가 존재합니다. 연체 도서 반납 전까지 추가 대여가 불가능합니다.';
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.rentals
        WHERE user_id = v_user_id AND book_id = p_book_id AND status = 'rented'
    ) INTO v_already_rented;

    IF v_already_rented THEN
        RAISE EXCEPTION '이미 대여 중인 도서입니다. 반납 후 다시 대여해 주세요.';
    END IF;

    SELECT available_copies INTO v_available_copies
    FROM public.books
    WHERE id = p_book_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '도서가 존재하지 않습니다.';
    END IF;

    IF v_available_copies <= 0 THEN
        RAISE EXCEPTION '현재 대여 가능한 재고가 없습니다.';
    END IF;

    UPDATE public.books
    SET available_copies = available_copies - 1
    WHERE id = p_book_id;

    INSERT INTO public.rentals (user_id, book_id, status)
    VALUES (v_user_id, p_book_id, 'rented');

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.return_book(p_rental_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    v_book_id BIGINT;
    v_user_id UUID;
    v_rental_status TEXT;
    v_is_admin BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '인증되지 않은 사용자입니다.';
    END IF;

    SELECT (role = 'admin') INTO v_is_admin
    FROM public.profiles
    WHERE id = v_user_id;

    SELECT book_id, status INTO v_book_id, v_rental_status
    FROM public.rentals
    WHERE id = p_rental_id AND (user_id = v_user_id OR COALESCE(v_is_admin, FALSE))
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '해당 대여 이력을 찾을 수 없습니다.';
    END IF;

    IF v_rental_status = 'returned' THEN
        RAISE EXCEPTION '이미 반납이 완료된 도서입니다.';
    END IF;

    UPDATE public.rentals
    SET returned_at = timezone('utc'::text, now()),
        status = 'returned'
    WHERE id = p_rental_id;

    UPDATE public.books
    SET available_copies = available_copies + 1
    WHERE id = v_book_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==========================================
-- 5. 닉네임으로 마스킹 이메일 조회 RPC 함수
-- ==========================================
CREATE OR REPLACE FUNCTION public.get_email_by_nickname(p_nickname TEXT)
RETURNS TEXT
AS $$
DECLARE
    v_email TEXT;
    v_local TEXT;
    v_domain TEXT;
    v_masked TEXT;
BEGIN
    -- profiles 테이블에서 닉네임으로 사용자 ID를 찾고, auth.users에서 이메일 조회
    SELECT au.email INTO v_email
    FROM public.profiles p
    JOIN auth.users au ON au.id = p.id
    WHERE p.nickname = p_nickname
    LIMIT 1;

    IF v_email IS NULL THEN
        RAISE EXCEPTION '해당 닉네임으로 가입된 정보를 찾을 수 없습니다.';
    END IF;

    -- 이메일 마스킹: 앞 2자만 보여주고 나머지는 ***
    v_local := SPLIT_PART(v_email, '@', 1);
    v_domain := SPLIT_PART(v_email, '@', 2);

    IF LENGTH(v_local) <= 2 THEN
        v_masked := v_local || '***@' || v_domain;
    ELSE
        v_masked := LEFT(v_local, 2) || '***@' || v_domain;
    END IF;

    RETURN v_masked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 6. 회원탈퇴 RPC (delete_user_account)
-- ==========================================
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS void AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION '로그인이 필요합니다.';
    END IF;

    -- auth.users 테이블에서 해당 사용자 삭제 (관련 데이터는 ON DELETE CASCADE로 삭제됨)
    DELETE FROM auth.users WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
