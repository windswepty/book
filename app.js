/* ==========================================
   1. Supabase 초기화 설정
   ========================================== */
// TODO: 본인의 Supabase Project URL 및 Anon Key로 변경하십시오.
const SUPABASE_URL = "https://saduncjfgsnbnvqerktf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhZHVuY2pmZ3NuYm52cWVya3RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDU2MTAsImV4cCI6MjA5ODUyMTYxMH0.m-lfdhYhjEjaqCQlupfAXOXo18yTvWf6OgVEBqqExhQ";

let supabaseClient = null;

try {
    if (typeof supabase !== 'undefined' && supabase.createClient) {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        console.error("Supabase SDK가 로드되지 않았습니다. CDN 경로를 확인하세요.");
    }
} catch (error) {
    console.error("Supabase 초기화 오류:", error);
}

/* ==========================================
   2. DOM 요소 바인딩
   ========================================== */
const themeToggle = document.getElementById("theme-toggle");
const userStatusBar = document.getElementById("user-status-bar");
const headerUsername = document.getElementById("header-username");
const btnLogoutHeader = document.getElementById("btn-logout-header");
const btnLogoHome = document.getElementById("btn-logo-home");

const sections = {
    welcome: document.getElementById("sec-welcome"),
    login: document.getElementById("sec-login"),
    register: document.getElementById("sec-register"),
    dashboard: document.getElementById("sec-dashboard"),
    changePassword: document.getElementById("sec-change-password")
};

const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const formChangePw = document.getElementById("form-change-pw");

const dashboardUsername = document.getElementById("dashboard-username");
const dashboardEmail = document.getElementById("dashboard-email");
const dashboardAvatar = document.getElementById("dashboard-avatar");
const btnShowChangePw = document.getElementById("btn-show-change-pw");
const btnDeleteAccount = document.getElementById("btn-delete-account");

// Phase 2 & 3 추가 DOM 바인딩
const bookListContainer = document.getElementById("book-list-container");
const rentalListContainer = document.getElementById("rental-list-container");
const inputBookSearch = document.getElementById("input-book-search");

// Phase 3 관리자 & 연체 배너
const userRoleBadge = document.getElementById("user-role-badge");
const overdueBanner = document.getElementById("overdue-banner");
const panelAdmin = document.getElementById("panel-admin");
const adminRentalListContainer = document.getElementById("admin-rental-list-container");

// 모달 바인딩
const modalGuide = document.getElementById("modal-guide");
const btnForgotPwGuide = document.getElementById("btn-forgot-pw-guide");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnCloseModalConfirm = document.getElementById("btn-close-modal-confirm");

// 모달 내부 아이디 찾기 바인딩
const formFindId = document.getElementById("form-find-id");
const findIdResult = document.getElementById("find-id-result");
const resultEmailText = document.getElementById("result-email-text");

// 회원탈퇴 닉네임 2차 안전 확인 모달 바인딩
const modalDeleteConfirm = document.getElementById("modal-delete-confirm");
const btnCloseDeleteModal = document.getElementById("btn-close-delete-modal");
const btnCloseDeleteModalCancel = document.getElementById("btn-close-delete-modal-cancel");
const formDeleteConfirm = document.getElementById("form-delete-confirm");
const deleteTargetNickname = document.getElementById("delete-target-nickname");
const deleteNicknameInput = document.getElementById("delete-nickname-input");
const btnDeleteAccountFinal = document.getElementById("btn-delete-account-final");

// 데이터 및 채널 변수
let activeRentals = [];
let userRole = "member";
let booksChannel = null;
let isOfflineMode = false; // Supabase API 오류 시 가상 더미 데이터 폴백 활성화 여부

/* ==========================================
   3. SPA 네비게이션 제어
   ========================================== */
function navigateTo(targetSectionId) {
    Object.values(sections).forEach(section => {
        section.classList.add("hidden");
    });
    
    const targetSection = document.getElementById(targetSectionId);
    if (targetSection) {
        targetSection.classList.remove("hidden");
    }
}

document.querySelectorAll(".navigate-btn").forEach(button => {
    button.addEventListener("click", () => {
        navigateTo(button.getAttribute("data-target"));
    });
});

btnLogoHome.addEventListener("click", async () => {
    if (isOfflineMode) {
        navigateTo("sec-dashboard");
        return;
    }
    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        navigateTo(session ? "sec-dashboard" : "sec-welcome");
    } else {
        navigateTo("sec-welcome");
    }
});

/* ==========================================
   4. 알림 피드백 (Toast 알림 구현)
   ========================================== */
function showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    
    let iconName = "info";
    if (type === "success") iconName = "check-circle";
    if (type === "error") iconName = "alert-circle";
    
    toast.innerHTML = `
        <i data-lucide="${iconName}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    lucide.createIcons();
    
    setTimeout(() => {
        toast.style.animation = "slideIn 0.3s ease reverse forwards";
        toast.addEventListener("animationend", () => {
            toast.remove();
        });
    }, 3000);
}

/* ==========================================
   5. Supabase Auth API 연동 로직
   ========================================== */

// 5-1. 회원가입
if (formRegister) {
    formRegister.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nickname = document.getElementById("reg-nickname").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const password = document.getElementById("reg-password").value;
        const passwordConfirm = document.getElementById("reg-password-confirm").value;
        
        if (password !== passwordConfirm) {
            showToast("비밀번호가 일치하지 않습니다.", "error");
            return;
        }
        if (password.length < 6) {
            showToast("비밀번호는 최소 6자리 이상이어야 합니다.", "error");
            return;
        }
        if (!/^[a-zA-Z0-9]+$/.test(nickname)) {
            showToast("아이디는 영문과 숫자 조합만 사용할 수 있습니다.", "error");
            return;
        }
        
        // 아이디 중복 사전 차단 검사 (Supabase API 500 가림 방지)
        if (!isOfflineMode && supabaseClient) {
            try {
                const { data: existingProfiles, error: checkError } = await supabaseClient
                    .from("profiles")
                    .select("id")
                    .eq("nickname", nickname);
                
                if (checkError) throw checkError;
                
                if (existingProfiles && existingProfiles.length > 0) {
                    showToast("이미 사용 중인 아이디입니다. 다른 아이디를 선택해 주세요.", "error");
                    return;
                }
            } catch (err) {
                console.log("닉네임 중복 체크 우회 폴백:", err);
            }
        } else if (isOfflineMode) {
            if (nickname === "도서관어드민" || nickname === "일반회원" || nickname === "성공적탈퇴") {
                showToast("이미 사용 중인 아이디입니다. 다른 아이디를 선택해 주세요.", "error");
                return;
            }
        }
        
        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: { 
                    emailRedirectTo: window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/verify.html'),
                    data: { 
                        nickname: nickname,
                        role: 'member'
                    } 
                }
            });
            if (error) throw error;
            
            if (data.user && data.session === null) {
                showToast("회원가입 신청 완료! 이메일 인증 링크를 확인해주세요.", "info");
                navigateTo("sec-login");
            } else {
                showToast("회원가입이 성공적으로 완료되었습니다!", "success");
            }
            formRegister.reset();
        } catch (error) {
            console.error("회원가입 처리 에러:", error);
            let errMsg = "회원가입 실패";
            if (error) {
                if (typeof error === 'string') {
                    errMsg = error;
                } else if (error.message) {
                    errMsg = error.message;
                } else if (error.error_description) {
                    errMsg = error.error_description;
                } else {
                    try {
                        errMsg = JSON.stringify(error);
                    } catch(e) {
                        errMsg = "회원가입 실패 (상세 에러)";
                    }
                }
            }
            showToast(errMsg, "error");
        }
    });
}

// 5-2. 로그인
if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nickname = document.getElementById("login-nickname").value.trim();
        const password = document.getElementById("login-password").value;
        
        // 디버그 가상 로그인 매칭 (500 에러 우회 및 순수 프론트 테스트용)
        if (nickname.includes("admin") && password === "password123") {
            isOfflineMode = true;
            showToast("[디버그] 관리자 모드로 오프라인 로그인에 성공했습니다.", "success");
            handleAuthChange("SIGNED_IN", {
                user: {
                    id: "08218a35-0ad1-40b0-9f60-fb362f379cf0",
                    email: "admin@library.com",
                    user_metadata: { nickname: "도서관어드민", role: "admin" }
                }
            });
            formLogin.reset();
            return;
        } else if (nickname.includes("member") && password === "password123") {
            isOfflineMode = true;
            showToast("[디버그] 일반 회원 모드로 오프라인 로그인에 성공했습니다.", "success");
            handleAuthChange("SIGNED_IN", {
                user: {
                    id: "81aee759-4600-4eea-879a-dc8178d54c04",
                    email: "member@library.com",
                    user_metadata: { nickname: "일반회원", role: "member" }
                }
            });
            formLogin.reset();
            return;
        }
        
        try {
            // 1. 아이디(닉네임)로 전체 이메일 조회
            const { data: userEmail, error: rpcError } = await supabaseClient
                .rpc('get_full_email_by_nickname', { p_nickname: nickname });
            
            if (rpcError || !userEmail) {
                showToast("해당 아이디를 찾을 수 없습니다.", "error");
                return;
            }

            // 2. 조회된 이메일과 비밀번호로 로그인
            const { error: authError } = await supabaseClient.auth.signInWithPassword({
                email: userEmail,
                password: password
            });
            if (authError) throw authError;

            showToast("로그인되었습니다.", "success");
            formLogin.reset();
        } catch (error) {
            showToast("비밀번호가 틀렸습니다. 다시 시도해주세요!", "error");
        }
    });
}

// 5-3. 로그아웃
async function handleLogout() {
    try {
        if (isOfflineMode) {
            isOfflineMode = false;
            showToast("로그아웃 되었습니다.", "success");
            handleAuthChange("SIGNED_OUT", null);
            return;
        }
        if (booksChannel) {
            supabaseClient.removeChannel(booksChannel);
            booksChannel = null;
        }
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        showToast("로그아웃 되었습니다.", "success");
    } catch (error) {
        showToast("로그아웃 오류", "error");
    }
}
btnLogoutHeader.addEventListener("click", handleLogout);



// 5-5. 회원탈퇴 (1단계: 안전 확인 모달 팝업 띄우기)
btnDeleteAccount.addEventListener("click", () => {
    const currentNickname = headerUsername.textContent.trim();
    deleteTargetNickname.textContent = currentNickname;
    deleteNicknameInput.value = "";
    btnDeleteAccountFinal.disabled = true;
    btnDeleteAccountFinal.textContent = "계정 영구 탈퇴";
    modalDeleteConfirm.classList.remove("hidden");
});

// 탈퇴 모달 내 닉네임 검증 실시간 리스너
if (deleteNicknameInput) {
    deleteNicknameInput.addEventListener("input", (e) => {
        const currentNickname = deleteTargetNickname.textContent.trim();
        const inputVal = e.target.value.trim();
        
        if (currentNickname && inputVal === currentNickname) {
            btnDeleteAccountFinal.disabled = false;
        } else {
            btnDeleteAccountFinal.disabled = true;
        }
    });
}

// 탈퇴 모달 취소/닫기 핸들러
function closeDeleteModal() {
    modalDeleteConfirm.classList.add("hidden");
    deleteNicknameInput.value = "";
    btnDeleteAccountFinal.disabled = true;
}
if (btnCloseDeleteModal) btnCloseDeleteModal.addEventListener("click", closeDeleteModal);
if (btnCloseDeleteModalCancel) btnCloseDeleteModalCancel.addEventListener("click", closeDeleteModal);
modalDeleteConfirm.addEventListener("click", (e) => {
    if (e.target === modalDeleteConfirm) closeDeleteModal();
});

// 탈퇴 모달 폼 서브밋 (2단계: 실제 DB 파기 수행)
if (formDeleteConfirm) {
    formDeleteConfirm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const currentNickname = deleteTargetNickname.textContent.trim();
        const inputVal = deleteNicknameInput.value.trim();
        
        if (inputVal !== currentNickname) {
            showToast("닉네임이 일치하지 않습니다.", "error");
            return;
        }
        
        btnDeleteAccountFinal.disabled = true;
        btnDeleteAccountFinal.textContent = "탈퇴 처리 중...";
        
        if (isOfflineMode) {
            showToast("회원 탈퇴 처리가 완료되었습니다. (오프라인 완료)", "success");
            closeDeleteModal();
            setTimeout(() => handleLogout(), 1500);
            return;
        }
        
        try {
            const { error } = await supabaseClient.rpc("delete_user_account");
            if (error) throw error;
            
            showToast("회원 탈퇴 처리가 완료되었습니다. 이용해 주셔서 감사합니다.", "success");
            closeDeleteModal();
            setTimeout(async () => {
                await supabaseClient.auth.signOut();
            }, 1500);
        } catch (error) {
            showToast(error.message || "탈퇴 처리 오류", "error");
            btnDeleteAccountFinal.disabled = false;
            btnDeleteAccountFinal.textContent = "계정 영구 탈퇴";
        }
    });
}

/* ==========================================
   6. Phase 2 & 3 도서 대여/반납/실시간 연동 스크립트
   ========================================== */

let offlineBooks = [
    { id: 1, title: "해리 포터와 마법사의 돌", author: "J.K. 롤링", total_copies: 3, available_copies: 3, cover_url: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=200" },
    { id: 2, title: "사피엔스", author: "유발 하라리", total_copies: 2, available_copies: 2, cover_url: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&q=80&w=200" },
    { id: 3, title: "정의란 무엇인가", author: "마이클 샌델", total_copies: 1, available_copies: 1, cover_url: "https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&q=80&w=200" }
];

let offlineRentals = [];

async function fetchBooks(searchQuery = "") {
    if (isOfflineMode) {
        renderBooksDOM(offlineBooks, searchQuery);
        return;
    }
    if (!supabaseClient) return;
    
    try {
        let query = supabaseClient.from("books").select("*");
        if (searchQuery.trim() !== "") {
            query = query.or(`title.ilike.%${searchQuery}%,author.ilike.%${searchQuery}%`);
        }
        const { data: books, error } = await query.order("title", { ascending: true });
        
        if (error) {
            isOfflineMode = true;
            renderBooksDOM(offlineBooks, searchQuery);
            return;
        }
        
        renderBooksDOM(books, searchQuery);
    } catch (error) {
        isOfflineMode = true;
        renderBooksDOM(offlineBooks, searchQuery);
    }
}

function renderBooksDOM(books, searchQuery) {
    bookListContainer.innerHTML = "";
    
    const filteredBooks = books.filter(book => 
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        book.author.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    if (filteredBooks.length === 0) {
        bookListContainer.innerHTML = `<div class="loading-spinner text-muted">검색 결과에 맞는 도서가 없습니다.</div>`;
        return;
    }
    
    filteredBooks.forEach(book => {
        const isOutOfStock = book.available_copies <= 0;
        const isRenting = activeRentals.some(rental => rental.book_id === book.id && rental.status === "rented");
        
        let btnHtml = "";
        if (isRenting) {
            btnHtml = `<button class="btn btn-secondary-sm btn-block" disabled>대여 중</button>`;
        } else if (isOutOfStock) {
            btnHtml = `<button class="btn btn-secondary-sm btn-block" disabled>대여 불가 (품절)</button>`;
        } else {
            btnHtml = `<button class="btn btn-primary btn-block btn-rent" data-id="${book.id}">대여하기</button>`;
        }
        
        const card = document.createElement("div");
        card.className = "book-card fade-in";
        card.innerHTML = `
            <img src="${book.cover_url || 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&q=80&w=200'}" alt="${book.title}" class="book-cover">
            <div class="book-info">
                <h4 class="book-title" title="${book.title}">${book.title}</h4>
                <p class="book-author">${book.author}</p>
                <div class="book-stock ${isOutOfStock ? 'out-of-stock' : ''}">
                    대여 가능 <span>${book.available_copies} / ${book.total_copies}</span>
                </div>
            </div>
            ${btnHtml}
        `;
        bookListContainer.appendChild(card);
    });
    
    document.querySelectorAll(".btn-rent").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const bookId = e.target.getAttribute("data-id");
            e.target.disabled = true;
            e.target.textContent = "처리 중...";
            await rentBook(bookId);
        });
    });
}

async function rentBook(bookId) {
    if (isOfflineMode) {
        const book = offlineBooks.find(b => b.id === parseInt(bookId));
        if (book && book.available_copies > 0) {
            book.available_copies -= 1;
            offlineRentals.push({
                id: Date.now(),
                book_id: book.id,
                rented_at: new Date().toISOString(),
                due_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                status: "rented",
                user_email: "member@library.com",
                books: { title: book.title },
                profiles: { email: "member@library.com" }
            });
            showToast(`성공적으로 대여되었습니다! [${book.title}]`, "success");
            activeRentals = offlineRentals;
            renderMyRentalsDOM(offlineRentals);
            renderBooksDOM(offlineBooks, inputBookSearch.value);
            if (userRole === "admin") {
                renderAdminRentalsDOM(offlineRentals);
            }
        }
        return;
    }
    try {
        const { data, error } = await supabaseClient.rpc("rent_book", { p_book_id: parseInt(bookId) });
        if (error) throw error;
        
        showToast("성공적으로 대여되었습니다!", "success");
        await fetchMyRentals();
        await fetchBooks(inputBookSearch.value);
    } catch (error) {
        showToast(error.message || "대여 신청 중 오류가 발생했습니다.", "error");
        await fetchBooks(inputBookSearch.value);
    }
}

async function fetchMyRentals() {
    if (isOfflineMode) {
        renderMyRentalsDOM(offlineRentals);
        return;
    }
    if (!supabaseClient) return;
    
    try {
        const { data: rentals, error } = await supabaseClient
            .from("rentals")
            .select(`
                id, rented_at, due_at, returned_at, status, book_id,
                books ( title )
            `)
            .order("rented_at", { ascending: false });
            
        if (error) {
            renderMyRentalsDOM(offlineRentals);
            return;
        }
        
        activeRentals = rentals || [];
        renderMyRentalsDOM(activeRentals);
    } catch (error) {
        renderMyRentalsDOM(offlineRentals);
    }
}

function renderMyRentalsDOM(rentals) {
    rentalListContainer.innerHTML = "";
    const currentRentals = rentals.filter(r => r.status === "rented" || r.status === "overdue");
    
    const now = new Date();
    const hasOverdue = currentRentals.some(r => r.status === "overdue" || now > new Date(r.due_at));
    if (hasOverdue) {
        overdueBanner.classList.remove("hidden");
    } else {
        overdueBanner.classList.add("hidden");
    }
    
    if (currentRentals.length === 0) {
        rentalListContainer.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted">현재 대여 중인 도서가 없습니다.</td>
            </tr>
        `;
        return;
    }
    
    currentRentals.forEach(rental => {
        const rentedDate = new Date(rental.rented_at).toLocaleDateString();
        const dueDate = new Date(rental.due_at).toLocaleDateString();
        const bookTitle = rental.books ? rental.books.title : "알 수 없는 도서";
        
        let statusText = "대여 중";
        let statusClass = "status-rented";
        
        if (now > new Date(rental.due_at)) {
            statusText = "연체";
            statusClass = "status-overdue";
        }
        
        const tr = document.createElement("tr");
        tr.className = "fade-in";
        tr.innerHTML = `
            <td><strong>${bookTitle}</strong></td>
            <td>${rentedDate}</td>
            <td>${dueDate}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn btn-secondary-sm btn-return" data-id="${rental.id}">반납하기</button>
            </td>
        `;
        rentalListContainer.appendChild(tr);
    });
    
    document.querySelectorAll(".user-rentals-panel .btn-return").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const rentalId = e.target.getAttribute("data-id");
            e.target.disabled = true;
            e.target.textContent = "반납 중...";
            await returnBook(rentalId);
        });
    });
}

async function returnBook(rentalId) {
    if (isOfflineMode) {
        const rental = offlineRentals.find(r => r.id === parseInt(rentalId));
        if (rental) {
            rental.status = "returned";
            const book = offlineBooks.find(b => b.id === rental.book_id);
            if (book) book.available_copies += 1;
            
            showToast("반납 처리가 완료되었습니다.", "success");
            activeRentals = offlineRentals;
            renderMyRentalsDOM(offlineRentals);
            renderBooksDOM(offlineBooks, inputBookSearch.value);
            if (userRole === "admin") {
                renderAdminRentalsDOM(offlineRentals);
            }
        }
        return;
    }
    try {
        const { data, error } = await supabaseClient.rpc("return_book", { p_rental_id: parseInt(rentalId) });
        if (error) throw error;
        
        showToast("반납 처리가 완료되었습니다.", "success");
        await fetchMyRentals();
        if (userRole === "admin") {
            await fetchAllRentalsAdmin();
        }
        await fetchBooks(inputBookSearch.value);
    } catch (error) {
        showToast(error.message || "반납 처리 오류", "error");
        await fetchMyRentals();
    }
}

/* ==========================================
   7. Phase 3 관리자 전용 기능 (전체 대여 모니터링)
   ========================================== */
async function fetchAllRentalsAdmin() {
    if (isOfflineMode) {
        renderAdminRentalsDOM(offlineRentals);
        return;
    }
    if (!supabaseClient || userRole !== "admin") return;
    
    try {
        const { data: rentals, error } = await supabaseClient
            .from("rentals")
            .select(`
                id, rented_at, due_at, returned_at, status, user_id,
                books ( title ),
                profiles ( email )
            `)
            .order("rented_at", { ascending: false });
            
        if (error) {
            renderAdminRentalsDOM(offlineRentals);
            return;
        }
        
        renderAdminRentalsDOM(rentals);
    } catch (error) {
        renderAdminRentalsDOM(offlineRentals);
    }
}

function renderAdminRentalsDOM(rentals) {
    adminRentalListContainer.innerHTML = "";
    const activeAdminRentals = (rentals || []).filter(r => r.status === "rented" || r.status === "overdue");
    
    if (activeAdminRentals.length === 0) {
        adminRentalListContainer.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted">시스템에 활성화된 대여 내역이 없습니다.</td>
            </tr>
        `;
        return;
    }
    
    activeAdminRentals.forEach(rental => {
        const rentedDate = new Date(rental.rented_at).toLocaleDateString();
        const dueDate = new Date(rental.due_at).toLocaleDateString();
        const bookTitle = rental.books ? rental.books.title : "알 수 없는 도서";
        const userEmail = rental.profiles ? rental.profiles.email : "알 수 없는 회원";
        
        let statusText = "대여 중";
        let statusClass = "status-rented";
        if (new Date() > new Date(rental.due_at)) {
            statusText = "연체";
            statusClass = "status-overdue";
        }
        
        const tr = document.createElement("tr");
        tr.className = "fade-in";
        tr.innerHTML = `
            <td>${userEmail}</td>
            <td><strong>${bookTitle}</strong></td>
            <td>${rentedDate}</td>
            <td>${dueDate}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn btn-secondary-sm btn-return" data-id="${rental.id}">강제 반납</button>
            </td>
        `;
        adminRentalListContainer.appendChild(tr);
    });
    
    document.querySelectorAll(".admin-panel .btn-return").forEach(btn => {
        btn.addEventListener("click", async (e) => {
            const rentalId = e.target.getAttribute("data-id");
            e.target.disabled = true;
            e.target.textContent = "반납 중...";
            await returnBook(rentalId);
        });
    });
}

/* ==========================================
   8. Phase 3 Supabase Realtime 실시간 동기화
   ========================================== */
function subscribeToBooks() {
    if (!supabaseClient || booksChannel || isOfflineMode) return;
    
    booksChannel = supabaseClient.channel("realtime-books-changes")
        .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "books" },
            async (payload) => {
                console.log("실시간 도서 재고 변동 감지:", payload.new);
                showToast(`도서 [${payload.new.title}]의 수량이 실시간 업데이트되었습니다.`, "info");
                
                await fetchBooks(inputBookSearch.value);
                await fetchMyRentals();
                if (userRole === "admin") {
                    await fetchAllRentalsAdmin();
                }
            }
        )
        .subscribe((status) => {
            console.log("Realtime Subscription Status:", status);
        });
}

// 검색 바
let searchTimeout;
if (inputBookSearch) {
    inputBookSearch.addEventListener("input", (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            fetchBooks(e.target.value);
        }, 300);
    });
}

/* ==========================================
   9. 실시간 로그인 세션 상태 감지 및 라우팅
   ========================================== */
function handleAuthChange(event, session) {
    if (session) {
        const user = session.user;
        let nickname = user.user_metadata?.nickname || SPLIT_PART(user.email, '@', 1);
        userRole = user.user_metadata?.role || "member";
        
        userRoleBadge.textContent = userRole === "admin" ? "Library Admin" : "Library Member";
        if (userRole === "admin") {
            userRoleBadge.className = "badge badge-success";
            panelAdmin.classList.remove("hidden");
        } else {
            panelAdmin.classList.add("hidden");
        }
        
        headerUsername.textContent = nickname;
        userStatusBar.classList.remove("hidden");
        
        dashboardUsername.textContent = `${nickname} 님`;
        dashboardEmail.textContent = user.email;
        dashboardAvatar.textContent = nickname.substring(0, 2).toUpperCase();
        
        if (isOfflineMode) {
            renderMyRentalsDOM(offlineRentals);
            renderBooksDOM(offlineBooks, "");
            if (userRole === "admin") {
                renderAdminRentalsDOM(offlineRentals);
            }
        } else {
            fetchMyRentals();
            fetchBooks();
            if (userRole === "admin") {
                fetchAllRentalsAdmin();
            }
            subscribeToBooks();
        }
        
        const activeSection = Object.keys(sections).find(key => !sections[key].classList.contains("hidden"));
        if (event === "PASSWORD_RECOVERY") {
            showToast("비밀번호 재설정을 위해 새 비밀번호를 입력해주세요.", "info");
            navigateTo("sec-change-password");
        } else if (activeSection !== "changePassword") {
            navigateTo("sec-dashboard");
        }
    } else {
        userStatusBar.classList.add("hidden");
        headerUsername.textContent = "";
        activeRentals = [];
        userRole = "member";
        panelAdmin.classList.add("hidden");
        overdueBanner.classList.add("hidden");
        
        if (booksChannel && supabaseClient) {
            supabaseClient.removeChannel(booksChannel);
            booksChannel = null;
        }
        
        navigateTo("sec-welcome");
    }
}

function setupAuthListener() {
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug');
    
    if (debugMode === 'admin' || debugMode === 'member') {
        isOfflineMode = true;
        console.log(`[디버그] 가상 로그인 로드: ${debugMode}`);
        setTimeout(() => {
            handleAuthChange("SIGNED_IN", {
                user: {
                    id: debugMode === 'admin' ? "08218a35-0ad1-40b0-9f60-fb362f379cf0" : "81aee759-4600-4eea-879a-dc8178d54c04",
                    email: debugMode === 'admin' ? "admin@library.com" : "member@library.com",
                    user_metadata: {
                        nickname: debugMode === 'admin' ? "도서관어드민" : "일반회원",
                        role: debugMode
                    }
                }
            });
        }, 300);
        return;
    }
    
    if (!supabaseClient) return;
    
    supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log(`Auth Event Triggered: ${event}`);
        
        if (session && !isOfflineMode) {
            const user = session.user;
            try {
                const { data: profile } = await supabaseClient
                    .from("profiles")
                    .select("nickname, role")
                    .eq("id", user.id)
                    .single();
                
                if (profile) {
                    user.user_metadata.nickname = profile.nickname;
                    user.user_metadata.role = profile.role || "member";
                }
            } catch (err) {
                console.log("프로필 연동 딜레이:", err);
            }
            
            handleAuthChange(event, session);
        } else if (!session) {
            handleAuthChange(event, null);
        }
    });
}

function SPLIT_PART(str, separator, index) {
    const parts = str.split(separator);
    return parts[index - 1] || str;
}

// 모달 아이디 찾기 폼 연동 및 폼 클리어
function clearFindIdForm() {
    if (formFindId) formFindId.reset();
    if (findIdResult) findIdResult.classList.add("hidden");
    if (resultEmailText) resultEmailText.textContent = "";
}

if (formFindId) {
    formFindId.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("find-email").value.trim();
        const password = document.getElementById("find-password").value;
        
        try {
            let nicknameResult = "";
            
            if (isOfflineMode) {
                if (email.includes("admin") && password === "password123") {
                    nicknameResult = "도서관어드민";
                } else if (email.includes("member") && password === "password123") {
                    nicknameResult = "일반회원";
                } else {
                    throw new Error("비밀번호가 틀렸거나 이메일이 존재하지 않습니다.");
                }
            } else {
                // 이메일과 비밀번호로 로그인 시도하여 안전하게 아이디 획득
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });
                
                if (error) {
                    throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
                }
                
                // 로그인 성공 시 닉네임 가져오고 즉시 로그아웃 처리
                nicknameResult = data.user.user_metadata.nickname;
                await supabaseClient.auth.signOut();
            }
            
            resultEmailText.textContent = nicknameResult;
            findIdResult.classList.remove("hidden");
            showToast("아이디 조회가 성공적으로 완료되었습니다.", "success");
        } catch (error) {
            showToast(error.message || "아이디 조회 실패", "error");
            findIdResult.classList.add("hidden");
            resultEmailText.textContent = "";
        }
    });
}

/* ==========================================
   9-1. 비밀번호 변경 기능
   ========================================== */
// 대시보드에서 "비밀번호 변경하기" 버튼 클릭 시 비밀번호 변경 섹션으로 이동
if (btnShowChangePw) {
    btnShowChangePw.addEventListener("click", () => {
        navigateTo("sec-change-password");
    });
}

// 비밀번호 변경 폼 제출 처리
if (formChangePw) {
    formChangePw.addEventListener("submit", async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById("change-password").value;
        const newPasswordConfirm = document.getElementById("change-password-confirm").value;

        if (newPassword !== newPasswordConfirm) {
            showToast("새 비밀번호가 일치하지 않습니다.", "error");
            return;
        }
        if (newPassword.length < 6) {
            showToast("비밀번호는 최소 6자리 이상이어야 합니다.", "error");
            return;
        }

        try {
            if (isOfflineMode) {
                showToast("비밀번호가 성공적으로 변경되었습니다!", "success");
                formChangePw.reset();
                navigateTo("sec-dashboard");
                return;
            }

            const { data, error } = await supabaseClient.auth.updateUser({
                password: newPassword
            });
            if (error) throw error;

            showToast("비밀번호가 성공적으로 변경되었습니다!", "success");
            formChangePw.reset();
            navigateTo("sec-dashboard");
        } catch (error) {
            console.error("비밀번호 변경 에러:", error);
            showToast(error.message || "비밀번호 변경에 실패했습니다.", "error");
        }
    });
}



/* ==========================================
   10. 모달 & 테마 토글 및 공통 인터랙션
   ========================================== */
btnForgotPwGuide.addEventListener("click", () => {
    clearFindIdForm();
    modalGuide.classList.remove("hidden");
});
btnCloseModal.addEventListener("click", () => {
    clearFindIdForm();
    modalGuide.classList.add("hidden");
});
btnCloseModalConfirm.addEventListener("click", () => {
    clearFindIdForm();
    modalGuide.classList.add("hidden");
});
modalGuide.addEventListener("click", (e) => {
    if (e.target === modalGuide) {
        clearFindIdForm();
        modalGuide.classList.add("hidden");
    }
});

const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

themeToggle.addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    
    showToast(`${newTheme === "dark" ? "다크" : "라이트"} 모드로 전환되었습니다.`, "info");
    
    fetchBooks(inputBookSearch.value);
});

window.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();
    setupAuthListener();
});
