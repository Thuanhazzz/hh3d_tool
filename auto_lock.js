// ==UserScript==
// @name          HH3D Auto - Edited by Krizk
// @namespace     HH3D_Tool_Tampermonkey
// @version       5.3.3
// @description   Thêm menu tùy chỉnh với các liên kết hữu ích và các chức năng tự động(sửa một chút so với bản gốc)
// @author        Dr. Trune & Krizk
// @match         https://hoathinh3d.moi/*
// @require       https://cdn.jsdelivr.net/npm/sweetalert2@11.26.12/dist/sweetalert2.all.min.js
// @run-at        document-start
// @grant         unsafeWindow
// @connect       raw.githubusercontent.com
// ==/UserScript==
(async function() {
    'use strict';

    console.log('%c[HH3D Script] Tải thành công. Đang khởi tạo UI tùy chỉnh.', 'background: #222; color: #bada55; padding: 2px 5px; border-radius: 3px;');

    // ===============================================
    // HÀM TIỆN ÍCH CHUNG
    // ===============================================
    const weburl = window.location.origin.replace(/\/+$/, '') + '/';
    const ajaxUrl = weburl + 'wp-content/themes/halimmovies-child/hh3d-ajax.php';
    let questionDataCache = null;
    const QUESTION_DATA_URL = 'https://raw.githubusercontent.com/syntaxerr0r/Vuong_Ma_Tu/refs/heads/main/vandap.json';
    let isCssInjected = false;
    let userBetCount = 0;
    let userBetStones = [];

     // Chỉ override khi đang ở trang Khoáng Mạch
    if (location.pathname.includes('khoang-mach') || location.href.includes('khoang-mach')) {
        const fastAttack = localStorage.getItem('khoangmach_fast_attack') === 'true';
        if (fastAttack) {
            const NEW_DELAY = 50;
            const originalSetInterval = window.setInterval;
            window.setInterval = function(callback, delay, ...args) {
                let actualDelay = delay;
                if (typeof callback === 'function' && callback.toString().includes('countdown--') &&
                        callback.toString().includes('clearInterval(countdownInterval)') &&
                        callback.toString().includes('executeAttack')){
                    actualDelay = NEW_DELAY
                    showNotification('Không được đánh đến khi hết thông báo này', 'error', 5500);
                }
            return originalSetInterval(callback, actualDelay, ...args);
            };
        }
    }
    // Cấu trúc menu
    const LINK_GROUPS = [{
        name: 'Autorun',
        links: [{
            text: 'Autorun',
            isAutorun: true
        }]
    }, {
        name: 'Điểm danh, Tế lễ, Vấn đáp',
        links: [{
            text: 'Điểm danh - Tế lễ - Vấn đáp',
            isDiemDanh: true
        }]
    }, {
        name: 'Hoang Vực, Thí Luyện, Phúc Lợi, Bí Cảnh',
        links: [{
            text: 'Hoang Vực',
            isHoangVuc: true
        }, {
            text: 'Thí Luyện',
            isThiLuyen: true
        }, {
            text: 'Phúc Lợi',
            isPhucLoi: true
        }, {
            text: 'Bí Cảnh',
            isBiCanh: true
        }]
    }, {
        name: 'Luận Võ',
        links: [{
            text: 'Luận Võ',
            isLuanVo: true
        }]
    }, {
        name: 'Khoáng mạch',
        links: [{
            text: 'Khoáng Mạch',
            isKhoangMach: true
        }]
    }, {
        name: 'Tiên Duyên',
        links: [{
            text: 'Tiên Duyên',
            isTienDuyen: true
        }]
    },{
        name: 'Bảng hoạt động ngày',
        links: [{
            text: 'Bảng hoạt động ngày',
            url: weburl + 'bang-hoat-dong-ngay?t'
        }, ]
    }, {
        name: 'Đổ Thạch',
        links: [{
            text: 'Đổ Thạch',
            isDiceRoll: true
        }]
    }, ];

    function addStyle(css) {
        const style = document.createElement('style');
        style.type = 'text/css';
        style.appendChild(document.createTextNode(css));
        document.head.appendChild(style);
    }

    /**
     * Lấy securityToken bằng cách fetch một URL (nếu có)
     * hoặc quét HTML của trang hiện tại (nếu không có URL).
     * Nếu gặp lỗi 403 (Forbidden), sẽ mở tab mới để người dùng đăng nhập lại.
     *
     * @param {string} [url] - (Tùy chọn) URL để fetch.
     * @returns {Promise<string|null>} - Một Promise sẽ resolve với token, hoặc null nếu thất bại.
     */
    async function getSecurityToken(url) {
        const logPrefix = "[SecurityTokenFetcher]";
        console.log(`${logPrefix} ▶️ Bắt đầu lấy security token từ ${url || 'trang hiện tại'}...`);
        let htmlContent = null;

        try {
            // 1. Lấy nội dung HTML (Fetch hoặc quét trang hiện tại)
            if (url) {
                const response = await fetch(url);
                if (!response.ok) {
                    console.error(`${logPrefix} ❌ Fetch thất bại với status: ${response.status}`);
                    // Chỉ mở tab mới khi lỗi 403 (Forbidden - phiên hết hạn/chưa đăng nhập)
                    if (response.status === 403) {
                        console.error(`${logPrefix} 🚨 Lỗi 403 Forbidden. Đang mở tab mới...`);
                        window.open(url, '_blank');
                        showNotification('Phiên đăng nhập hết hạn (403). Đã mở tab mới, vui lòng đăng nhập lại.', 'error');
                    }
                    return null;
                }
                htmlContent = await response.text();
            } else {
                htmlContent = document.documentElement.outerHTML;
            }

            // 2. Quét Regex lấy Token mới
            const regex = /"securityToken"\s*:\s*"([^"]+)"/;
            const match = htmlContent.match(regex);

            if (match && match[1]) {
                const token = match[1];

                // 🔥 LOGIC MỚI: Kiểm tra xem URL yêu cầu có phải là trang hiện tại không, bằng cách kiểm tra trang hiện tại có bao gồm không
                // Nếu không truyền URL (!url) -> Mặc định là trang hiện tại
                // Nếu có URL -> Phải trùng khớp với window.location.href
                const isCurrentPage = !url || (window.location.href.includes(url));

                if (isCurrentPage) {
                    console.log(`${logPrefix} 🎯 URL trùng khớp trang hiện tại. Tiến hành cập nhật Global State...`);

                    // ============================================================
                    // 🔥 SỬA LỖI: CẬP NHẬT XUYÊN SANDBOX
                    // ============================================================

                    // Cách 1: Dùng unsafeWindow (Cách chuẩn của Tampermonkey)
                    if (typeof unsafeWindow !== 'undefined' && unsafeWindow.hh3dData) {
                        unsafeWindow.hh3dData.securityToken = token;
                        console.log(`${logPrefix} 🔓 Đã cập nhật hh3dData thông qua unsafeWindow.`);
                    }
                    // Cách 2: Fallback nếu không có unsafeWindow
                    else if (typeof window.hh3dData !== 'undefined') {
                        window.hh3dData.securityToken = token;
                        console.log(`${logPrefix} ⚠️ Đã cập nhật hh3dData qua window thường.`);
                    } else {
                        // Cách 3: "Tiêm thuốc" trực tiếp
                        try {
                            console.log(`${logPrefix} 💉 Tiêm script cập nhật token trực tiếp vào trang...`);
                            const script = document.createElement('script');
                            script.textContent = `
                                try {
                                    if (typeof hh3dData !== 'undefined') {
                                        hh3dData.securityToken = "${token}";
                                        console.log('✅ [Inject] Token đã được cập nhật từ bên trong trang web.');
                                    }
                                } catch(e) {}
                            `;
                            (document.head || document.body || document.documentElement).appendChild(script);
                            script.remove();
                        } catch (injectErr) {
                            console.warn(`${logPrefix} Lỗi tiêm script:`, injectErr);
                        }
                    }
                    // ============================================================
                } else {
                    //  - Token chỉ được trả về cho hàm gọi, không ảnh hưởng trang hiện tại
                    console.log(`${logPrefix} 🛑 Token lấy từ URL khác (${url}). KHÔNG cập nhật hh3dData của trang này.`);
                }

                return token;
            }
            
            // Không tìm thấy token trong HTML
            console.error(`${logPrefix} ❌ Không tìm thấy securityToken trong HTML.`);
            return null;

        } catch (e) {
            console.error(`${logPrefix} ❌ Lỗi:`, e);
            return null;
        }
    }

    //Lấy Nonce
    async function getNonce() {
        if (typeof customRestNonce !== 'undefined' && customRestNonce) {
            return customRestNonce;
        }

        const scripts = document.querySelectorAll('script');
        for (const script of scripts) {
            const match = script.innerHTML.match(/customRestNonce\s*=\s*'([a-f0-9]+)'/);
            if (match) {
                return match[1];
            }
        }

        try {
            const nonce = await getSecurityNonce(weburl + '?t', /customRestNonce\s*=\s*'([a-f0-9]+)'/);
            if (nonce) {
                return nonce;
            }
        } catch (error) {
            console.error("Failed to get security nonce", error);
        }

        return null;
    }

     /**
     * Lấy security nonce một cách chung chung từ một URL.
     * Đồng thời cập nhật securityToken nếu tìm thấy trong HTML (vì token được tạo mới khi load page).
     *
     * @param {string} url - URL của trang web cần lấy nonce.
     * @param {RegExp} regex - Biểu thức chính quy (regex) để tìm và trích xuất nonce.
     * @returns {Promise<string|null>} Trả về security nonce nếu tìm thấy, ngược lại trả về null.
     */
    async function getSecurityNonce(url, regex) {
        // Sử dụng một tiền tố log cố định cho đơn giản
        const logPrefix = '[HH3D Auto]';

        console.log(`${logPrefix} ▶️ Đang tải trang từ ${url} để lấy security nonce...`);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();

            // 🔥 CẬP NHẬT: Trích xuất và cập nhật securityToken nếu có trong HTML
            const tokenRegex = /"securityToken"\s*:\s*"([^"]+)"/;
            const tokenMatch = html.match(tokenRegex);
            if (tokenMatch && tokenMatch[1]) {
                const token = tokenMatch[1];
                console.log(`${logPrefix} 🔑 Phát hiện securityToken mới trong HTML, đang cập nhật...`);

                // Kiểm tra URL có phải trang hiện tại không
                const isCurrentPage = window.location.href.includes(url);

                if (isCurrentPage) {
                    // Cập nhật xuyên sandbox giống getSecurityToken
                    if (typeof unsafeWindow !== 'undefined' && unsafeWindow.hh3dData) {
                        unsafeWindow.hh3dData.securityToken = token;
                        console.log(`${logPrefix} 🔓 Đã cập nhật hh3dData.securityToken thông qua unsafeWindow.`);
                    } else if (typeof window.hh3dData !== 'undefined') {
                        window.hh3dData.securityToken = token;
                        console.log(`${logPrefix} ⚠️ Đã cập nhật hh3dData.securityToken qua window thường.`);
                    } else {
                        // Tiêm script trực tiếp
                        try {
                            const script = document.createElement('script');
                            script.textContent = `
                                try {
                                    if (typeof hh3dData !== 'undefined') {
                                        hh3dData.securityToken = "${token}";
                                        console.log('✅ [Inject] Token đã được cập nhật từ getSecurityNonce.');
                                    }
                                } catch(e) {}
                            `;
                            (document.head || document.body || document.documentElement).appendChild(script);
                            script.remove();
                        } catch (injectErr) {
                            console.warn(`${logPrefix} Lỗi tiêm script:`, injectErr);
                        }
                    }
                }
            }

            const match = html.match(regex);
            if (match && match[1]) {
                const nonce = match[1];
                console.log(`${logPrefix} ✅ Đã trích xuất thành công security nonce: ${nonce}`);
                return nonce;
            } else {
                console.error(`${logPrefix} ❌ Không tìm thấy security nonce trong mã nguồn.`);
                return null;
            }
        } catch (e) {
            console.error(`${logPrefix} ❌ Lỗi khi tải trang hoặc trích xuất nonce:`, e);
            return null;
        }
    }


    // Lấy ID tài khoản
    async function getAccountId() {
        const html = document.documentElement.innerHTML;
        const regexList = [
            /"user_id"\s*:\s*"(\d+)"/,       // "user_id":"123"
            /current_user_id\s*:\s*'(\d+)'/  // current_user_id: '123'
        ];

        // --- Thử lấy trực tiếp từ DOM ---
        for (const regex of regexList) {
            const match = html.match(regex);
            if (match) {
                console.log('Lấy account ID trực tiếp từ html');
                return match[1];
            }
        }

        // --- Fallback: thử fetch trang chính với từng regex ---
        for (const regex of regexList) {
            const id = await getSecurityNonce(weburl + '?t', regex);
            if (id) {
                console.log('Lấy account ID qua fetch fallback');
                return id;
            }
        }

        return null;
    }

    // Lưu trữ trạng thái các hoạt động đã thực hiện
    class TaskTracker {
        constructor(storageKey = 'dailyTasks') {
            this.storageKey = storageKey;
            this.data = this.loadData();
            this.dothachTimeoutId = null;
        }

        // Tải dữ liệu từ localStorage
        loadData() {
            const storedData = localStorage.getItem(this.storageKey);
            return storedData ? JSON.parse(storedData) : {};
        }

        // Lưu dữ liệu vào localStorage
        saveData() {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
        }

        /** Lấy thông tin của một tài khoản cụ thể và tự động cập nhật nếu sang ngày mới
            * @param {string} accountId - ID của tài khoản.
            * @return {object} Trả về dữ liệu tài khoản, bao gồm các nhiệm vụ và trạng thái.
            * Nếu tài khoản chưa có dữ liệu, nó sẽ tự động tạo mới và lưu vào localStorage.
            * Nếu ngày hôm nay đã được cập nhật, nó sẽ reset các nhiệm vụ cho ngày mới.
            * Nếu đã đến giờ chuyển sang lượt 2 của Đổ Thạch, nó sẽ tự động chuyển trạng thái.
        */
        getAccountData(accountId) {
            if (!this.data[accountId]) {
                this.data[accountId] = {};
                this.saveData();
            }

            const accountData = this.data[accountId];
            const today = new Date().toLocaleDateString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'});


            // Danh sách tất cả nhiệm vụ mặc định
            const defaultTasks = {
                diemdanh: { done: false },
                thiluyen: { done: false, nextTime: null },
                bicanh: { done: false, nextTime: null },
                phucloi: { done: false, nextTime: null, monthly_reward_claimed: false },
                hoangvuc: { done: false, nextTime: null },
                dothach: { betplaced: false, reward_claimed: false, turn: 1 },
                luanvo: { battle_joined: false, auto_accept: false, done: false },
                khoangmach: {done: false, nextTime: null},
                tienduyen: {done: false, last_check: null, uoc_nguyen_done: false},
                hoatdongngay: {done: false},
                event: {nextTime: null}
            };

            if (accountData.lastUpdatedDate !== today) {
                console.log(`[TaskTracker] Cập nhật dữ liệu ngày mới cho tài khoản: ${accountId}`);
                accountData.lastUpdatedDate = today;
                // Reset toàn bộ nhiệm vụ
                Object.assign(accountData, defaultTasks);
                this.saveData();
            } else {
                // Ngày chưa đổi → merge các nhiệm vụ mới
                let updated = false;
                for (const taskName in defaultTasks) {
                    if (!accountData[taskName]) {
                        accountData[taskName] = defaultTasks[taskName];
                        updated = true;
                    }
                }
                if (updated) this.saveData();
            }

            // Xử lý Đổ Thạch lượt 2
            const now = new Date();
                const hourInVN = parseInt(
                    new Date().toLocaleString('en-US', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                        hour: 'numeric',
                        hour12: false
                    }),
                    10
                );
            if (accountData.dothach.turn === 1 && hourInVN >= 16) {
                accountData.dothach = {
                    betplaced: false,
                    reward_claimed: false,
                    turn: 2,
                };
                this.saveData();
            }

            // Lên lịch tự động reset vào 16h hàng ngày nếu chưa có timer
            if (!this.dothachTimeoutId) {
                const now = new Date();

                // Tạo danh sách mốc reset theo thứ tự
                const resetTimes = [
                    new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 1, 0, 0), // 16h hôm nay
                    new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 1, 0, 0, 0) // 01h sáng mai
                ];

                // Tìm mốc reset gần nhất so với hiện tại
                let nextResetTime = resetTimes.find(t => t > now);
                if (!nextResetTime) {
                    // Nếu đã qua tất cả mốc → chọn 16h ngày mai
                    nextResetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 16, 0, 0, 0);
                }

                const timeToWait = nextResetTime - now;

                console.log(`[TaskTracker] Reset sau ${Math.floor(timeToWait / 1000 / 60)} phút.`);

                this.dothachTimeoutId = setTimeout(() => {
                    this.getAccountData(accountId);
                }, timeToWait);
            }

            return accountData;
        }

        /**
         * Cập nhật một thuộc tính cụ thể của một nhiệm vụ.
         * @param {string} accountId - ID của tài khoản.
         * @param {string} taskName - Tên nhiệm vụ (ví dụ: 'dothach').
         * @param {string} key - Tên thuộc tính cần cập nhật (ví dụ: 'betplaced').
         * @param {*} value - Giá trị mới cho thuộc tính.
         */
        updateTask(accountId, taskName, key, value) {
            const accountData = this.getAccountData(accountId);
            if (accountData[taskName]) {
                accountData[taskName][key] = value;
                this.saveData();
            } else {
                console.error(`[TaskTracker] Nhiệm vụ "${taskName}" không tồn tại cho tài khoản "${accountId}"`);
            }
        }

        /** Lấy thông tin task
         * @param {string} accountId - ID của tài khoản.
         * @param {string} taskName - Tên nhiệm vụ: 'diemdanh', 'thiluyen', 'bicanh', 'phucloi', 'hoangvuc'.
         * @return {object|null} Trả về đối tượng nhiệm vụ hoặc null nếu không tồn tại.
         * Ví dụ:  getTaskStatus('123', 'luanvo').battle_joined => 'true'
         */
        getTaskStatus(accountId, taskName) {
            const accountData = this.getAccountData(accountId);
            return accountData[taskName] || null;
        }

        /**
         * Kiểm tra xem một nhiệm vụ đã hoàn thành hay chưa
         * @param {string} accountId - ID của tài khoản.
         * @param {string} taskName - Tên nhiệm vụ: 'diemdanh', 'thiluyen', 'bicanh', 'phucloi', 'hoangvuc'.
         * @return {boolean} Trả về `true` nếu nhiệm vụ đã hoàn thành, ngược lại là `false`.
         */
        isTaskDone(accountId, taskName) {
            const accountData = this.getAccountData(accountId);
            return accountData[taskName] && accountData[taskName].done;
        }

        /**
         * Đánh dấu một nhiệm vụ là đã hoàn thành
         * @param {string} accountId - ID của tài khoản.
         * @param {string} taskName - Tên nhiệm vụ: 'diemdanh', 'thiluyen', 'bicanh', 'phucloi', 'hoangvuc'.
         * @return {void}
         */
        markTaskDone(accountId, taskName) {
            const accountData = this.getAccountData(accountId);
            if (accountData[taskName]) {
                accountData[taskName].done = true;
                this.saveData();
            } else {
                console.error(`[TaskTracker] Nhiệm vụ "${taskName}" không tồn tại cho tài khoản "${accountId}"`);
            }
        }
        markTaskUndone(accountId, taskName) {
            const accountData = this.getAccountData(accountId);
            if (accountData[taskName]) {
                accountData[taskName].done = false;
                this.saveData();
            } else {
                console.error(`[TaskTracker] Nhiệm vụ "${taskName}" không tồn tại cho tài khoản "${accountId}"`);
            }
        }

        /**
         * Điều chỉnh thời gian của một nhiệm vụ
         * @param {string} accountId - ID của tài khoản.
         * @param {string} taskName - Tên nhiệm vụ: 'thiluyen', 'bicanh', 'phucloi', 'hoangvuc'.
         * @param {string} newTime - Thời gian mới theo định dạng timestamp.
         * @return {void}
         */
        adjustTaskTime(accountId, taskName, newTime) {
            const accountData = this.getAccountData(accountId);
            if (accountData[taskName]) {
                accountData[taskName].nextTime = newTime;
                this.saveData();
            } else {
                console.error(`[TaskTracker] Nhiệm vụ "${taskName}" không tồn tại cho tài khoản "${accountId}"`);
            }
        }

        getNextTime(accountId, taskName) {
            const accountData = this.getAccountData(accountId);
            const ts = accountData[taskName]?.nextTime;
            if (!ts || ts === "null") {
                return null; // chưa có thời gian
            }
            const date = new Date(Number(ts));
            return isNaN(date.getTime()) ? null : date;
        }


        /** Return dạng Date */
        getLastCheckTienDuyen(accountId) {
            const accountData = this.getTaskStatus(accountId, 'tienduyen');
            const timestamp = Number(accountData.last_check); // Chuyển chuỗi miligiây thành số
            return new Date(timestamp); // Tạo đối tượng Date
        }

        /** Lấy cả timstamp dạng string hay Date đều được */
        setLastCheckTienDuyen(accountId, timestamp) {
            let finalTimestamp = timestamp; // Khởi tạo biến lưu giá trị cuối cùng
            // Kiểm tra nếu timestamp là một đối tượng Date
            if (timestamp instanceof Date) {
                finalTimestamp = timestamp.getTime(); // Lấy giá trị timestamp dạng số
            }
            this.updateTask(accountId, 'tienduyen', 'last_check', finalTimestamp);
        }


    }


    /**
     * Cộng thêm phút và giây vào thời điểm hiện tại và trả về một đối tượng Date mới.
     * @param {string} timeString - Chuỗi thời gian định dạng "mm:ss" (phút:giây).
     * @returns {Date} - String dạng timestamp cho thời gian được cộng thêm
     */
    function timePlus(timeString) {
        const now = new Date();
        const [minutes, seconds] = timeString.split(':').map(Number);
        const millisecondsToAdd = (minutes * 60 + seconds) * 1000;
        return now.getTime() + millisecondsToAdd;
        }


    // ===============================================
    // VẤN ĐÁP
    // ===============================================

    class VanDap {
        constructor(nonce) {
            this.nonce = nonce
            this.ajaxUrl = ajaxUrl;
            this.QUESTION_DATA_URL = QUESTION_DATA_URL;
            this.taskTracker = taskTracker;
            this.questionDataCache = null;
        }

        /**
         * * Tải dữ liệu đáp án từ nguồn GitHub.
         * * Dữ liệu được lưu vào cache để tránh các lần tìm nạp không cần thiết.
         */
        async loadAnswersFromGitHub() {
            if (this.questionDataCache) {
                return;
            }
            console.log('[Vấn Đáp] ▶️ Đang tải đáp án...');
            try {
                const response = await fetch(this.QUESTION_DATA_URL);
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                this.questionDataCache = await response.json();
                console.log("[Vấn Đáp] ✅ Đã tải đáp án.");
            } catch (e) {
                console.error("[Vấn Đáp] ❌ Lỗi tải hoặc parse JSON:", e);
                showNotification('Lỗi khi tải đáp án. Vui lòng thử lại.', 'error');
                throw e; // Ném lại lỗi để hàm gọi xử lý
            }
        }

        /**
         * Tìm câu trả lời đúng cho một câu hỏi và gửi nó đi.
         * @param {object} question Đối tượng câu hỏi từ máy chủ.
         * @param {object} headers Headers của yêu cầu để gửi đi.
         * @param {string} securityToken Token bảo mật để xác thực yêu cầu.
         * @returns {Promise<boolean>} True nếu câu trả lời được gửi thành công, ngược lại là false.
         */
        async checkAnswerAndSubmit(question, headers, securityToken) {
            // 1. Định nghĩa các hàm helper (như logic Đua Top)
            // Normalize: Xóa hết ký tự đặc biệt và khoảng trắng để so sánh tuyệt đối
            const normalize = (str) => str ? str.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?\s]/g, '') : '';
            
            // Tokenize: Giữ lại khoảng trắng để tách từ, dùng cho việc tính điểm
            const tokenize = (str) => str ? str.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ').trim().split(/\s+/).filter(x => x) : [];

            const normalizedIncomingQuestion = normalize(question.question);
            let foundAnswer = null;

            // 2. Tìm câu trả lời trong dữ liệu cache
            for (const storedQuestionKey in this.questionDataCache.questions) {
                if (normalize(storedQuestionKey) === normalizedIncomingQuestion) {
                    foundAnswer = this.questionDataCache.questions[storedQuestionKey];
                    break;
                }
            }

            if (!foundAnswer) {
                showNotification(`<b>Vấn Đáp:</b> Không tìm thấy đáp án cho câu hỏi: <i>${question.question}</i>`, 'error');
                return false;
            }

            // 3. Tìm chỉ mục (Index) trong options
            // Ưu tiên 1: Tìm chính xác (Exact Match)
            let answerIndex = question.options.findIndex(option => 
                normalize(option) === normalize(foundAnswer)
            );

            // Ưu tiên 2: Nếu không thấy, tìm theo điểm trùng từ (Similarity Score)
            if (answerIndex === -1) {
                console.warn(`[Vấn Đáp] ⚠️ Không khớp chính xác option nào. Đang tính điểm trùng từ cho: "${foundAnswer}"`);
                
                let maxScore = -1;
                let bestIdx = -1;
                const targetTokens = tokenize(foundAnswer);

                question.options.forEach((option, idx) => {
                    const optTokens = tokenize(option);
                    // Đếm số từ trong Option xuất hiện trong Answer Cache
                    const intersection = optTokens.filter(token => targetTokens.includes(token));
                    const score = intersection.length;

                    if (score > maxScore) {
                        maxScore = score;
                        bestIdx = idx;
                    }
                });

                // Chỉ chọn nếu có ít nhất 1 từ trùng (score > 0)
                if (bestIdx > -1 && maxScore > 0) {
                    answerIndex = bestIdx;
                    console.log(`[Vấn Đáp] 🎯 Chọn option theo điểm cao nhất (${maxScore}): ${question.options[bestIdx]}`);
                }
            }

            if (answerIndex === -1) {
                showNotification(`Vấn Đáp: Câu hỏi: <i>${question.question}</i> có đáp án mẫu là "${foundAnswer}" nhưng không khớp option nào trong server.`, 'error');
                return false;
            }

            //const securityToken = await getSecurityToken(weburl + 'van-dap-tong-mon?t');
            // 4. Gửi câu trả lời
            const payloadSubmitAnswer = new URLSearchParams();
            payloadSubmitAnswer.append('action', 'save_quiz_result');
            payloadSubmitAnswer.append('security_token', securityToken);
            payloadSubmitAnswer.append('answer', answerIndex);
            payloadSubmitAnswer.append('question_id', question.id);
            

            try {
                const responseSubmit = await fetch(this.ajaxUrl, {
                    method: 'POST',
                    headers: headers,
                    body: payloadSubmitAnswer,
                    credentials: 'include'
                });

                const dataSubmit = await responseSubmit.json();
                if (dataSubmit.success) {
                    return true;
                } else {
                    showNotification(`Vấn Đáp: ${dataSubmit.message}`, 'error');
                    return false;
                }
            } catch (error) {
                showNotification(`Vấn Đáp: ${error.message}`, 'error');
                return false;
            }
        }


        /**
         * Hàm chính để chạy quy trình Vấn Đáp.
         * @param {string} nonce Nonce của WordPress để xác thực.
         */
        async doVanDap(nonce) {
            const securityToken = await getSecurityToken(weburl + 'van-dap-tong-mon?t');
            try {
                await this.loadAnswersFromGitHub();

                console.log('[HH3D Vấn Đáp] ▶️ Bắt đầu Vấn Đáp');
                const headers = {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-Wp-Nonce': nonce,
                };

                let correctCount = 0;
                let answeredThisSession = 0;
                const maxAttempts = 10;
                let currentAttempt = 0;
                let totalQuestions = 0;

                while (correctCount < 5 && currentAttempt < maxAttempts) {
                    currentAttempt++;
                    const payloadLoadQuiz = new URLSearchParams();
                    payloadLoadQuiz.append('action', 'load_quiz_data');
                    payloadLoadQuiz.append('security_token', securityToken);

                    const responseQuiz = await fetch(this.ajaxUrl, {
                        method: 'POST',
                        headers: headers,
                        body: payloadLoadQuiz,
                        credentials: 'include'
                    });

                    const dataQuiz = await responseQuiz.json();

                    if (!dataQuiz.success || !dataQuiz.data) {
                        showNotification(`Vấn Đáp: ${dataQuiz.data|| 'Lỗi khi lấy câu hỏi'}`, 'warn');
                        return;
                    }

                    if (dataQuiz.data.completed) {
                        showNotification('Đã hoàn thành vấn đáp hôm nay.', 'success');
                        taskTracker.markTaskDone(accountId, 'diemdanh');
                        return;
                    }

                    if (!dataQuiz.data.questions) {
                        showNotification(`Vấn Đáp: Không có câu hỏi nào được tải.`, 'warn');
                        return;
                    }

                    const questions = dataQuiz.data.questions;
                    totalQuestions = questions.length;
                    correctCount = dataQuiz.data.correct_answers || 0;
                    const questionsToAnswer = questions.slice(correctCount);

                    if (questionsToAnswer.length === 0) {
                        break;
                    }

                    let newAnswersFound = false;
                    for (const question of questionsToAnswer) {
                        const isAnsweredSuccessfully = await this.checkAnswerAndSubmit(question, headers, securityToken);
                        if (isAnsweredSuccessfully) {
                            answeredThisSession++;
                            newAnswersFound = true;
                        }
                    }

                    if (!newAnswersFound) {
                        showNotification(`Vấn Đáp: Không tìm thấy câu trả lời mới, dừng lại.`, 'warn');
                        break;
                    }

                    if (correctCount + answeredThisSession < 5) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

                // Tìm nạp trạng thái cuối cùng để báo cáo chính xác
                const finalPayload = new URLSearchParams();
                finalPayload.append('action', 'load_quiz_data');
                const finalResponse = await fetch(this.ajaxUrl, {
                    method: 'POST',
                    headers: headers,
                    body: finalPayload,
                    credentials: 'include'
                });
                const finalData = await finalResponse.json();
                if (finalData.success && finalData.data) {
                    correctCount = finalData.data.correct_answers || correctCount;
                    totalQuestions = finalData.data.questions.length || totalQuestions;
                }

                showNotification(`Hoàn thành Vấn Đáp. Đã trả lời thêm ${answeredThisSession} câu. Tổng số câu đúng: ${correctCount}/${totalQuestions}`, 'success');

            } catch (e) {
                console.error(`[HH3D Vấn Đáp] ❌ Lỗi xảy ra:`, e);
                showNotification(`Lỗi khi thực hiện Vấn Đáp: ${e.message}`, 'error');
            }
        }
    }

    // ===============================================
    // ĐIỂM DANH
    // ===============================================
    async function doDailyCheckin(nonce) {
        try {
                console.log('[HH3D Daily Check-in] ▶️ Bắt đầu Daily Check-in');
                const url = weburl + 'wp-json/hh3d/v1/action';
                const headers = {
                    'Content-Type': 'application/json',
                    'X-Wp-Nonce': nonce,
                    'X-Requested-With': 'XMLHttpRequest'
                };

                const bodyPayload = {
                    action: 'daily_check_in'
                };

                const response = await fetch(url, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify(bodyPayload),
                    credentials: 'include',
                    referrer: weburl + 'diem-danh',
                    mode: 'cors'
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    showNotification(`Điểm danh: ${data.message} (${data.streak} ngày)`, 'success');
                } else {
                    showNotification(`Điểm danh: ${data.message || 'Lỗi không xác định'}`, 'warn');
                }
            } catch (e) {
                console.error(`[HH3D Daily Check-in] ❌ Lỗi xảy ra:`, e);
                showNotification(`Lỗi khi thực hiện Daily Check-in: ${e.message}`, 'error');
         }
    }

    // ===============================================
    // TẾ LỄ TÔNG MÔN
    // ===============================================
    async function doClanDailyCheckin(nonce) {
        const securityToken = await getSecurityToken(weburl + 'danh-sach-thanh-vien-tong-mon?t');
        try {
            console.log('[HH3D Clan Check-in] ▶️ Bắt đầu Clan Check-in');

            // Giả định 'weburl' được định nghĩa ở scope bên ngoài
            const url = weburl + "wp-json/tong-mon/v1/te-le-tong-mon";

            // --- 1. CẬP NHẬT HEADERS ---
            const headers = {
                "Content-Type": "application/json",
                "X-WP-Nonce": nonce,
                "security_token": securityToken
            };

            // --- 2. CẬP NHẬT BODY ---
            const bodyPayload = {
                action: "te_le_tong_mon",
                security_token: securityToken
            };

            const response = await fetch(url, {
                "credentials": "include",
                "headers": headers, // (Đã cập nhật)
                "referrer": weburl + "danh-sach-thanh-vien-tong-mon",
                "body": JSON.stringify(bodyPayload), // <-- THAY ĐỔI TỪ "{}"
                "method": "POST",
                "mode": "cors"
            });

            // Logic xử lý response giữ nguyên
            const data = await response.json();
            if (response.ok && data.success) {
                showNotification(`Tế lễ: ${data.message} (${data.cong_hien_points})`, 'success');
            } else {
                showNotification(`Tế lễ: ${data.message || 'Lỗi không xác định'}`, 'warn');
            }
        } catch (e) {
            console.error(`[HH3D Clan Check-in] ❌ Lỗi xảy ra:`, e);
            showNotification(`Lỗi khi thực hiện Clan Check-in: ${e.message}`, 'error');
        }
    }

    // ===============================================
    // HÀM ĐỔ THẠCH
    // ===============================================

    /**
    * Lớp quản lý tính năng Đổ Thạch (Dice Roll).
    *
    * Hướng dẫn sử dụng:
    * 1. Tạo một thực thể của lớp, cung cấp các phụ thuộc cần thiết.
    *    const doThachManager = new DoThach();
    *
    * 2. Gọi phương thức run với chiến lược mong muốn ('tài' hoặc 'xỉu').
    *    await doThachManager.run('tài');
    */
    class DoThach {
        constructor() {
            this.ajaxUrl = ajaxUrl;
            this.webUrl = weburl;
            this.doThachUrl = this.webUrl + 'do-thach-hh3d?t';
        }

        // --- Các phương thức private để gọi API và lấy nonce ---
        /*
        async #getLoadDataNonce() {
            return this.getSecurityNonce(this.doThachUrl, /action: 'load_do_thach_data',[\s\S]*?security: '([a-f0-9]+)'/);
        }

        async #getPlaceBetNonce() {
            return this.getSecurityNonce(this.doThachUrl, /action: 'place_do_thach_bet',[\s\S]*?security: '([a-f0-9]+)'/);
        }

        async #getClaimRewardNonce() {
            return this.getSecurityNonce(this.doThachUrl, /action: 'claim_do_thach_reward',[\s\S]*?security: '([a-f0-9]+)'/);
        }

        /**
         * Lấy thông tin phiên đổ thạch hiện tại.
         * @param {string} securityNonce - Nonce cho yêu cầu.
         * @returns {Promise<object|null>} Dữ liệu phiên hoặc null nếu có lỗi.
         */
        async #getDiceRollInfo() {
            console.log('[HH3D Đổ Thạch] ▶️ Đang lấy thông tin phiên...');
            const securityToken = await getSecurityToken(this.doThachUrl);
            const payload = new URLSearchParams({ action: 'load_do_thach_data', security_token: securityToken });
            const headers = {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
            };

            try {
                const response = await fetch(this.ajaxUrl, { method: 'POST', headers, body: payload });
                const data = await response.json();
                if (data.success) {
                    console.log('[HH3D Đổ Thạch] ✅ Tải thông tin phiên thành công.');
                    return data.data;
                }
                console.error('[HH3D Đổ Thạch] ❌ Lỗi từ API:', data.data || 'Lỗi không xác định');
                return null;
            } catch (e) {
                console.error('[HH3D Đổ Thạch] ❌ Lỗi mạng:', e);
                return null;
            }
        }

        /**
         * Đặt cược vào một viên đá cụ thể.
         * @param {object} stone - Đối tượng đá để đặt cược.
         * @param {number} betAmount - Số tiền cược.
         * @returns {Promise<boolean>} True nếu đặt cược thành công.
         */
        async #placeBet(stone, betAmount) {
            console.log(`[HH3D Đặt Cược] 🪙 Đang cược ${betAmount} Tiên Ngọc vào ${stone.name}...`);
            const securityToken = await getSecurityToken(this.doThachUrl);
            const payload = new URLSearchParams({
                action: 'place_do_thach_bet',
                security_token: securityToken,
                stone_id: stone.stone_id,
                bet_amount: betAmount
            });
            const headers = {
                'Accept': '*/*',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
            };

            try {
                const response = await fetch(this.ajaxUrl, { method: 'POST', headers, body: payload });
                const data = await response.json();

                if (data.success) {
                    showNotification(`✅ Cược thành công vào ${stone.name}!<br>Tỷ lệ <b>x${stone.reward_multiplier}</b>`, 'success');
                    this._alreadyClaimedReward = false; // reset flag
                    return true;
                }
                else if (data.data === 'Vui lòng nhận thưởng kỳ trước rồi mới tiếp tục đặt cược.') {
                    if (!this._alreadyClaimedReward) {
                        if (await this.#claimReward()) {
                            this._alreadyClaimedReward = true;
                            return await this.#placeBet(stone, betAmount);
                        } else {
                            showNotification(`❌ Không thể nhận thưởng kỳ trước, vui lòng thử lại.`, 'error');
                        }
                    } else {
                        showNotification(`❌ Đã thử nhận thưởng nhưng vẫn không cược được.`, 'error');
                    }
                    this._alreadyClaimedReward = false; // reset flag
                    return false;
                }

                const errorMessage = data.data || data.message || 'Lỗi không xác định.';
                showNotification(`❌ Lỗi cược: ${errorMessage}`, 'error');
                this._alreadyClaimedReward = false;
                return false;
            } catch (e) {
                showNotification(`❌ Lỗi mạng khi cược: ${e.message}`, 'error');
                this._alreadyClaimedReward = false;
                return false;
            }
        }

        /**
         * Nhận thưởng cho một lần cược thắng.
         * @returns {Promise<boolean>} True nếu nhận thưởng thành công.
         */
        async #claimReward() {
            console.log('[HH3D Nhận Thưởng] 🎁 Đang nhận thưởng...');
            const securityToken = await getSecurityToken(this.doThachUrl);
            const payload = new URLSearchParams({ action: 'claim_do_thach_reward', security_token: securityToken});
            const headers = {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
            };

            try {
                const response = await fetch(this.ajaxUrl, { method: 'POST', headers, body: payload });
                const data = await response.json();
                if (data.success) {
                    const rewardMessage = data.data?.message || `Nhận thưởng thành công!`;
                    showNotification(rewardMessage, 'success');
                    return true;
                }
                const errorMessage = data.data?.message || 'Lỗi không xác định khi nhận thưởng.';
                showNotification(errorMessage, 'error');
                return false;
            } catch (e) {
                console.error(e);
                showNotification(`❌ Lỗi mạng khi nhận thưởng: ${e.message}`, 'error');
                return false;
            }
        }

        // --- Phương thức public để chạy toàn bộ quy trình ---

        /**
         * Chạy toàn bộ quy trình đổ thạch dựa trên chiến lược đã chọn.
         * @param {string} stoneType - Chiến lược đặt cược ('tài' hoặc 'xỉu').
         */
        async run(stoneType) {
            console.log(`[HH3D Đổ Thạch] 🧠 Bắt đầu quy trình với chiến lược: ${stoneType}...`);

            // Bước 1: Lấy thông tin phiên
            const sessionData = await this.#getDiceRollInfo();

            if (!sessionData) {
                console.error('[HH3D Đổ Thạch] ❌ Không thể lấy dữ liệu phiên, dừng lại.');
                return;
            }

            const userBetStones = sessionData.stones.filter(stone => stone.bet_placed);

            // Bước 2: Kiểm tra trạng thái phiên và hành động (nhận thưởng hoặc đặt cược)
            if (sessionData.winning_stone_id) {
                console.log('[HH3D Đổ Thạch] 🎁 Đã có kết quả. Kiểm tra nhận thưởng...');
                const claimableWin = userBetStones.find(s => s.stone_id === sessionData.winning_stone_id && !s.reward_claimed);
                const alreadyClaimed = userBetStones.find(s => s.stone_id === sessionData.winning_stone_id && s.reward_claimed);

                if (claimableWin) {
                    console.log(`[HH3D Đổ Thạch] 🎉 Trúng rồi! Đá cược: ${claimableWin.name}. Đang nhận thưởng...`);
                    await this.#claimReward();
                } else if (alreadyClaimed) {
                    console.log(`[HH3D Đổ Thạch] ✅ Đã nhận thưởng cho phiên này.`);
                } else if (userBetStones.length > 0) {
                    showNotification('[Đổ Thạch] 🥲 Rất tiếc, bạn không trúng phiên này.', 'info');
                } else {
                    showNotification('[Đổ Thạch] 😶 Bạn không tham gia phiên này.', 'info');
                }
                taskTracker.updateTask(accountId, 'dothach', 'reward_claimed', 'true')
                return;
            }

            // Bước 3: Nếu đang trong giờ cược, tiến hành đặt cược
            console.log('[HH3D Đổ Thạch] 💰 Đang trong thời gian đặt cược.');
            const userBetCount = userBetStones.length;

            if (userBetCount >= 2) {
                showNotification('[Đổ Thạch] ⚠️ Đã cược đủ 2 lần. Chờ phiên sau.', 'warn');
                taskTracker.updateTask(accountId, 'dothach', 'betplaced', true);
                return;
            }

            const sortedStones = [...sessionData.stones].sort((a, b) => b.reward_multiplier - a.reward_multiplier);
            const availableStones = sortedStones.filter(stone => !stone.bet_placed);

            if (availableStones.length === 0) {
                showNotification('[Đổ Thạch] ⚠️ Không còn đá nào để cược!', 'warn');
                return;
            }

            const betAmount = 20;
            const stonesToBet = [];
            const normalizedStoneType = stoneType.toLowerCase();
            const betsRemaining = 2 - userBetCount;

            if (normalizedStoneType === 'tài' || normalizedStoneType === 'tai') {
                stonesToBet.push(...availableStones.slice(0, betsRemaining));
            } else if (normalizedStoneType === 'xỉu' || normalizedStoneType === 'xiu') {
                const xiuStones = availableStones.slice(2, 4);
                stonesToBet.push(...xiuStones.slice(0, betsRemaining));
            } else {
                console.log('[HH3D Đổ Thạch] ❌ Chiến lược không hợp lệ. Vui lòng chọn "tài" hoặc "xỉu".');
                return;
            }

            if (stonesToBet.length === 0) {
                console.log('[HH3D Đổ Thạch] ⚠️ Không có đá nào phù hợp chiến lược hoặc đã cược đủ.');
                return;
            }

            let successfulBets = 0;
            for (const stone of stonesToBet) {
                const success = await this.#placeBet(stone, betAmount);
                if (success) {
                    successfulBets++;
                }
            }

            // Kiểm tra và cập nhật trạng thái ngay sau khi cược
            if (userBetCount + successfulBets >= 2) {
                taskTracker.updateTask(accountId, 'dothach', 'betplaced', true);
            }
        }
    }
    // ===============================================
    // THÍ LUYỆN TÔNG MÔN
    // ===============================================

    async function doThiLuyenTongMon() {
        console.log('[HH3D Thí Luyện Tông Môn] ▶️ Bắt đầu Thí Luyện Tông Môn');

        // Bước 1: Lấy security
        const securityToken = await getSecurityToken(weburl + 'thi-luyen-tong-mon-hh3d?t');
        const url = ajaxUrl;
        const payload = new URLSearchParams();
        payload.append('action', 'open_chest_tltm');
        payload.append('security_token', securityToken);
        

        const headers = {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: payload,
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                // Trường hợp thành công
                const message = data.data && data.data.message ? data.data.message : 'Mở rương thành công!';
                showNotification(message, 'success');
            } else {
                // Trường hợp thất bại
                if (data.data.message === "Đã hoàn thành Thí Luyện Tông Môn hôm nay, quay lại vào ngày kế tiếp.") {
                    showNotification(data.data.message, 'info');
                    taskTracker.markTaskDone(accountId, 'thiluyen');
                } else {
                    showNotification(data.data.message, 'error');
                }
            };
            const timePayload = new URLSearchParams();
                timePayload.append('action', 'get_remaining_time_tltm');
                timePayload.append('security_token', securityToken);
            const timeResponse = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: timePayload,
                credentials: 'include'
            })
            const timeData = await timeResponse.json();
            if (timeData.success) {
                const time = timeData.data.time_remaining;
                taskTracker.adjustTaskTime(accountId,'thiluyen', timePlus(time));
            } else {
                console.error('❌ Lỗi khi lấy thời gian còn lại:', timeData.data || 'Lỗi không xác định');
            }

        } catch (e) {
            showNotification(`Lỗi mạng khi thực hiện Thí Luyện: ${e.message}`, 'error');
        }
    }

    // ===============================================
    // PHÚC LỢI
    // ===============================================
    async function doPhucLoiDuong() {
        console.log('[HH3D Phúc Lợi Đường] ▶️ Bắt đầu nhiệm vụ Phúc Lợi Đường.');
        const url = ajaxUrl;
        const headers = {
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
        };

        // Bước 1: Lấy thông tin thời gian còn lại và cấp độ rương
        console.log('[HH3D Phúc Lợi Đường] ⏲️ Đang kiểm tra thời gian mở rương...');
        const securityToken = await getSecurityToken(weburl + 'phuc-loi-duong?t');
        const payloadTime = new URLSearchParams();
        payloadTime.append('action', 'get_next_time_pl');
        payloadTime.append('security_token', securityToken);

        try {
            const responseTime = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: payloadTime,
                credentials: 'include'
            });
            const dataTime = await responseTime.json();

            if (dataTime.success) {
                const { time, chest_level: chest_level_string } = dataTime.data;
                const chest_level = parseInt(chest_level_string, 10);

                // Return khi mở đủ 4 chest
                if (chest_level >= 4) {
                    showNotification('Phúc Lợi Đường đã hoàn tất hôm nay!', 'success');
                    taskTracker.markTaskDone(accountId, 'phucloi');
                    return;
                }

                if (time === '00:00') {
                    // Bước 3: Nếu thời gian bằng 00:00, tiến hành mở rương
                    console.log(`[HH3D Phúc Lợi Đường] 🎁 Đang mở rương cấp ${chest_level + 1}...`);
                    const payloadOpen = new URLSearchParams();
                    payloadOpen.append('action', 'open_chest_pl');
                    payloadOpen.append('security_token', securityToken);
                    payloadOpen.append('chest_id', chest_level + 1);

                    const responseOpen = await fetch(url, {
                        method: 'POST',
                        headers: headers,
                        body: payloadOpen,
                        credentials: 'include'
                    });
                    const dataOpen = await responseOpen.json();

                    if (dataOpen.success) {
                        const message = dataOpen.data && dataOpen.data.message ? dataOpen.data.message : 'Mở rương thành công!';
                        showNotification(message, 'success');
                        if (message.includes('đã hoàn thành Phúc Lợi ngày hôm nay')) {
                            taskTracker.markTaskDone(accountId, 'phucloi');
                        } else taskTracker.adjustTaskTime(accountId,'phucloi', timePlus('30:00'));
                    } else {
                        const errorMessage = dataOpen.data && dataOpen.data.message ? dataOpen.data.message : 'Lỗi không xác định khi mở rương.';
                        showNotification(errorMessage, 'error');
                    }
                } else {
                    // Trường hợp còn thời gian
                    showNotification(`Vui lòng đợi ${time} để mở rương tiếp theo.`, 'warn');
                    taskTracker.adjustTaskTime(accountId,'phucloi', timePlus(time));
                };
            } else {
                const errorMessage = dataTime.data && dataTime.data.message ? dataTime.data.message : 'Lỗi không xác định khi lấy thời gian.';
                showNotification(errorMessage, 'error');
            }
        } catch (e) {
            showNotification(`Lỗi mạng khi thực hiện Phúc Lợi Đường: ${e.message}`, 'error');
        }

        //Claim bonus reward on the last 2 day of the month
        const isMonthlyRewardClaimed = taskTracker.getTaskStatus(accountId, 'phucloi').monthly_reward_claimed;
        if (isMonthlyRewardClaimed) {return;}

        // Tính mốc 00:00 hai ngày cuối tháng theo giờ VN
        const now = new Date();
        const tzNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const startOfToday = new Date(tzNow.getFullYear(), tzNow.getMonth(), tzNow.getDate());
        const startOfTomorrow = new Date(startOfToday);
        startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
        const startOfLastTwoDays = new Date(tzNow.getFullYear(), tzNow.getMonth() + 1, 0); // 00:00 last day
        startOfLastTwoDays.setDate(startOfLastTwoDays.getDate() - 1); // lùi về 00:00 ngày kế cuối

        if (startOfToday >= startOfLastTwoDays && tzNow < startOfTomorrow) {
            console.log('[HH3D Phúc Lợi Đường] 🎉 Đang nhận thưởng cuối tháng...');
            for (let i = 1; i <= 4; i++) {
                const payloadBonus = new URLSearchParams();
                payloadBonus.append('action', 'claim_bonus_reward');
                payloadBonus.append('chest_id', i);
                try {
                    const responseBonus = await fetch(url, {
                        method: 'POST',
                        headers: headers,
                        body: payloadBonus,
                        credentials: 'include'
                    });
                    const dataBonus = await responseBonus.json();
                    if (dataBonus.success) {
                        showNotification(dataBonus.data.message, 'success');
                        if (i === 4) {
                            taskTracker.updateTask(accountId, 'phucloi', 'monthly_reward_claimed', true);
                        }
                    } else if (dataBonus.data.message === 'Phần thưởng cho mốc này đã được nhận trước đó.') {
                        if (i === 4) {
                            taskTracker.updateTask(accountId, 'phucloi', 'monthly_reward_claimed', true);
                        }
                        continue; // skip already claimed
                    } else if (dataBonus.data.message === 'Chưa đủ yêu cầu nhận thưởng.') {
                        if (i === 1) {return;} // skip if first chest not eligible
                    } else {
                        showNotification(dataBonus.data.message, 'info');
                    }
                } catch (e) {
                    showNotification(`Lỗi  khi nhận thưởng cuối tháng: ${e.message}`, 'error');
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }   
        }
    }

    // ===============================================
    // BÍ CẢNH
    // ===============================================
    class BiCanh {
        constructor() {
            this.weburl = weburl;
            this.logPrefix = '[HH3D Bí Cảnh]';
        }

        /**
         * Phương thức chính để thực hiện toàn bộ nhiệm vụ Bí Cảnh.
         */
        async doBiCanh() {
            console.log(`${this.logPrefix} ▶️ Bắt đầu nhiệm vụ Bí Cảnh Tông Môn.`);

            // Bước 1: Lấy Nonce bảo mật
            const nonce = await this.getNonce();
            if (!nonce) {
                showNotification('Lỗi: Không thể lấy nonce cho Bí Cảnh Tông Môn.', 'error');
                throw new Error ('Lỗi nonce bí cảnh');
            }

            // Bước 2: Kiểm tra thời gian hồi
            await new Promise(resolve => setTimeout(resolve, 500));
            const canAttack = await this.checkAttackCooldown(nonce);
            if (!canAttack) {
                return true;
            }

            // Bước 3: Tấn công boss Bí Cảnh
            await new Promise(resolve => setTimeout(resolve, 500));
            await this.attackBoss(nonce);
        }

        /**
         * Lấy nonce từ trang Bí Cảnh Tông Môn.
         * @returns {Promise<string|null>} Nonce bảo mật hoặc null nếu lỗi.
         */
        async getNonce() {
            const nonce = await getSecurityNonce(weburl + 'bi-canh-tong-mon?t', /"nonce":"([a-f0-9]+)"/);
            if (nonce) {
                return nonce;
            } else {
                return null;
            }
        }

        /**
         * Kiểm tra xem có thể tấn công boss Bí Cảnh hay không.
         * @param {string} nonce - Nonce bảo mật.
         * @returns {Promise<boolean>} True nếu có thể tấn công, ngược lại là false.
         */
        async checkAttackCooldown(nonce) {
            console.log(`${this.logPrefix} ⏲️ Đang kiểm tra thời gian hồi chiêu...`);
            const endpoint = 'wp-json/tong-mon/v1/check-attack-cooldown';

            try {
                const response = await this.sendApiRequest(endpoint, 'POST', nonce, {});
                if (response && response.success && response.can_attack) {
                    if (response.remaining_attacks === 5 || response.remaining_attacks === 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const rewardResponse = await this.sendApiRequest('wp-json/tong-mon/v1/claim-boss-reward', 'POST', nonce, {});
                        if (rewardResponse && rewardResponse.success) {
                            showNotification(rewardResponse.message, 'success', 10000);
                        }
                    }
                    console.log(`${this.logPrefix} ✅ Có thể tấn công.`);
                    return true;
                }
                // Kiểm tra trường hợp boss chết: Nhận thưởng và hiến tế
                else if (response.success && response.message === 'Không có boss để tấn công') {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    const rewardResponse = await this.sendApiRequest('wp-json/tong-mon/v1/claim-boss-reward', 'POST', nonce, {});
                    if (rewardResponse && rewardResponse.success) {
                        showNotification(rewardResponse.message, 'success', 10000);
                    };
                    const contributionResponse = await this.sendApiRequest('wp-json/tong-mon/v1/contribute-boss', 'POST', nonce, {});
                    if (contributionResponse) {
                        if (contributionResponse.success) {showNotification(contributionResponse.message, 'success')}
                        else {showNotification(contributionResponse.message, 'warn')}
                    } else
                    return false;
                }
                else {
                    if (response && response.success && response.cooldown_remaining) {
                        taskTracker.adjustTaskTime(accountId, 'bicanh', Date.now()+ response.cooldown_remaining*1000)
                    }
                    const message = response?.message || 'Không thể tấn công vào lúc này.';
                    showNotification(`⏳ ${message}`, 'info');
                    return false;
                }
            } catch (e) {
                showNotification(`${this.logPrefix} ❌ Lỗi kiểm tra cooldown: ${e.message}`, 'error');
                return false;
            }
        }

        /**
         * Gửi yêu cầu tấn công boss Bí Cảnh.
         * @param {string} nonce - Nonce bảo mật.
         */
        async attackBoss(nonce) {
            console.log(`${this.logPrefix} 🔥 Đang khiêu chiến boss...`);
            const endpoint = 'wp-json/tong-mon/v1/attack-boss';

            try {
                const response = await this.sendApiRequest(endpoint, 'POST', nonce, {});
                if (response && response.success) {
                    const message = response.message || `Gây ${response.damage} sát thương.`;
                    showNotification(message, 'success');
                    taskTracker.adjustTaskTime(accountId, 'bicanh', timePlus('07:00'));
                } else {
                    const errorMessage = response?.message || 'Lỗi không xác định khi tấn công.';
                    showNotification(errorMessage, 'error');
                }
            } catch (e) {
                showNotification(`Lỗi mạng khi tấn công boss Bí Cảnh: ${e.messeage}`, 'error');
            }
        }


        /**  Kiểm tra xem có đạt giới hạn tấn công hàng ngày hay không.
         * @returns {Promise<boolean>} True nếu đạt giới hạn, ngược lại là false.
         * */
        async isDailyLimit() {
            const endpoint = 'wp-json/tong-mon/v1/check-attack-cooldown';
            const nonce = await this.getNonce();
            if (!nonce) {
                return false;
            }
            try {
                const response = await this.sendApiRequest(endpoint, 'POST', nonce, {});
                if (response && response.success && response.cooldown_type	=== 'daily_limit' ) {
                    return true;
                } else {
                    return false;
                }
            } catch (e) {
                console.error(`${this.logPrefix} ❌ Lỗi kiểm tra cooldown:`, e);
                return false;
            }
        }


        /**
         * Hàm trợ giúp để gửi yêu cầu API.
         * @param {string} endpoint - Điểm cuối API.
         * @param {string} method - HTTP method (GET, POST).
         * @param {string} nonce - Nonce bảo mật.
         * @param {object} body - Dữ liệu body.
         * @returns {Promise<object|null>} Phản hồi từ API.
         */
        async sendApiRequest(endpoint, method, nonce, body = {}) {
            try {
                const url = `${this.weburl}${endpoint}`;
                const headers = {
                    "Content-Type": "application/json",
                    "X-WP-Nonce": nonce,
                    "Accept": "*/*",
                    "Accept-Language": "vi,en-US;q=0.5",
                    "X-Requested-With": "XMLHttpRequest",
                };
                const response = await fetch(url, {
                    method,
                    headers,
                    body: JSON.stringify(body),
                    credentials: 'include'
                });
                return await response.json();
            } catch (error) {
                console.error(`${this.logPrefix} ❌ Lỗi khi gửi yêu cầu tới ${endpoint}:`, error);
                throw error;
            }
        }
    }

    // ===============================================
    // HOANG VỰC
    // ===============================================

    class HoangVuc {
        constructor() {
            this.ajaxUrl = `${weburl}wp-content/themes/halimmovies-child/hh3d-ajax.php`;
            this.adminAjaxUrl = `${weburl}wp-admin/admin-ajax.php`;
            this.logPrefix = "[HH3D Hoang Vực]";
            this.headers = {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
            };
        }
        /**
         * Lấy nguyên tố của người dùng từ trang Hoang Vực.
         */
        async getMyElement() {
            const url = weburl + 'hoang-vuc?t';
            const response = await fetch(url);
            const text = await response.text();
            const regex = /<img id="user-nguhanh-image".*?src=".*?ngu-hanh-(.*?)\.gif"/;
            const match = text.match(regex);
            if (match && match[1]) {
                const element = match[1];
                console.log(`${this.logPrefix} ✅ Đã lấy được nguyên tố của bạn: ${element}`);
                return element;
            } else {
                console.error(`${this.logPrefix} ❌ Không tìm thấy nguyên tố của người dùng.`);
                return null;
            }
        }

        /**
         * Xác định nguyên tố tối ưu dựa trên boss và chiến lược.
         * @param {string} bossElement - Nguyên tố của boss.
         * @param {boolean} maximizeDamage - true: tối đa hóa sát thương; false: tránh giảm sát thương.
         * @returns {Array<string>} Mảng chứa các nguyên tố phù hợp.
         */
        getTargetElement(bossElement, maximizeDamage) {
            const rules = {
                'kim': { khắc: 'moc', bị_khắc: 'hoa' },
                'moc': { khắc: 'tho', bị_khắc: 'kim' },
                'thuy': { khắc: 'hoa', bị_khắc: 'tho' },
                'hoa': { khắc: 'kim', bị_khắc: 'thuy' },
                'tho': { khắc: 'thuy', bị_khắc: 'moc' },
            };

            const suitableElements = [];

            if (maximizeDamage) {
                // Tối đa hóa sát thương: tìm nguyên tố khắc boss
                for (const myElement in rules) {
                    if (rules[myElement].khắc === bossElement) {
                        suitableElements.push(myElement);
                        break; // Chỉ cần một nguyên tố khắc là đủ
                    }
                }
            } else {
                // Không bị giảm sát thương: tìm tất cả các nguyên tố không bị boss khắc
                for (const myElement in rules) {
                    if (rules[myElement].bị_khắc !== bossElement) {
                        suitableElements.push(myElement);
                    }
                }
            }
            return suitableElements;
        }

        /**
         * Nhận thưởng Hoang Vuc.
         */
        async claimHoangVucRewards(nonce) {
            const payload = new URLSearchParams();
            payload.append('action', 'claim_chest');
            payload.append('nonce', nonce);

            console.log(`${this.logPrefix} 🎁 Đang nhận thưởng...`);
            const response = await fetch(this.adminAjaxUrl, {
                method: 'POST',
                headers: this.headers,
                body: payload,
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                const rewards = data.total_rewards;
                const message = `✅ Nhận thưởng thành công: +${rewards.tinh_thach} Tinh Thạch, +${rewards.tu_vi} Tu Vi.`;
                console.log(message);
                showNotification(message, 'success');
            } else {
                console.error(`${this.logPrefix} ❌ Lỗi khi nhận thưởng:`, data.message || 'Lỗi không xác định.');
                showNotification(data.message || 'Lỗi khi nhận thưởng.', 'error');
            }
        }

        /**
         * Tấn công boss Hoang Vực.
         * @param {string} bossId - ID của boss cần tấn công.
         * @param {string} nonce - Nonce bảo mật.
         * @returns {Promise<boolean>} `True` nếu tấn công thành công, ngược lại là `false`.
         */
        async attackHoangVucBoss(bossId, nonce) {
            const currentTime = Date.now();
            const securityToken = await getSecurityToken(weburl + 'hoang-vuc?t');
            const payload = new URLSearchParams();
            payload.append('action', 'attack_boss');
            payload.append('boss_id', bossId);
            payload.append('security_token', securityToken);
            payload.append('nonce', nonce);
            payload.append('request_id', `req_${Math.random().toString(36).substring(2, 8)}${currentTime}`);

            console.log(`${this.logPrefix} ⚔️ Đang tấn công boss...`);
            const response = await fetch(this.ajaxUrl, {
                method: 'POST',
                headers: this.headers,
                body: payload,
                credentials: 'include'
            });
            const data = await response.json();
            if (data.success) {
                showNotification('✅ Tấn công boss hoang vực hành công', 'success');
                return true
            } else if (data.data.error === 'Đạo hữu đã hết lượt tấn công trong ngày.') {
                taskTracker.markTaskDone(accountId, 'hoangvuc');
                showNotification('Đạo hữu đã hết lượt tấn công trong ngày.', 'info');
                return true;
            }
            else {
                const errorMessage = data.data.error || 'Lỗi không xác định khi tấn công.';
                showNotification(errorMessage, 'error');
                return false;
            }
        }

        /**
         * Lặp lại việc đổi nguyên tố cho đến khi đạt được nguyên tố phù hợp hoặc không thể đổi tiếp.
         * @param {string} currentElement - Nguyên tố hiện tại của người dùng.
         * @param {string} bossElement - Nguyên tố của boss.
         * @param {boolean} maximizeDamage - Chiến lược tối đa hóa sát thương hay không.
         * @param {string} nonce - Nonce bảo mật.
         * @returns {Promise<string|null>} Nguyên tố mới nếu đổi thành công, ngược lại là null.
         */
        async changeElementUntilSuitable(currentElement, bossElement, maximizeDamage, nonce) {
            let myElement = currentElement;
            let changeAttempts = 0;
            const MAX_ATTEMPTS = 5;

            const rules = {
                'kim':  { khắc: 'moc',  bị_khắc: 'hoa' },
                'moc':  { khắc: 'tho',  bị_khắc: 'kim' },
                'thuy': { khắc: 'hoa',  bị_khắc: 'tho' },
                'hoa':  { khắc: 'kim',  bị_khắc: 'thuy' },
                'tho':  { khắc: 'thuy', bị_khắc: 'moc' },
            };

            function isOptimal(el) {
                return rules[el].khắc === bossElement;
            }
            function isNeutral(el) {
                return rules[el].bị_khắc !== bossElement;
            }

            while (changeAttempts < MAX_ATTEMPTS) {
                changeAttempts++;

                const currentlyOptimal = isOptimal(myElement);
                const currentlyNeutral = isNeutral(myElement);

                // 🔎 Kiểm tra trước khi đổi
                if (!currentlyNeutral) {
                    console.log(`${this.logPrefix} ❌ Đang bị boss khắc chế -> phải đổi.`);
                } else {
                    if (maximizeDamage && currentlyOptimal) {
                        console.log(`${this.logPrefix} 🌟 Đang ở trạng thái tối ưu. Dừng đổi.`);
                        return myElement;
                    }
                    if (!maximizeDamage && currentlyNeutral) {
                        console.log(`${this.logPrefix} ✅ Đang ở trạng thái hòa (không bị giảm). Dừng đổi.`);
                        return myElement;
                    }
                }

                // 🔄 Tiến hành đổi element
                const payloadChange = new URLSearchParams({ action: 'change_user_element', nonce });
                const changeData = await (await fetch(this.ajaxUrl, {
                    method: 'POST',
                    headers: this.headers,
                    body: payloadChange,
                    credentials: 'include'
                })).json();

                if (changeData.success) {
                    myElement = changeData.data.new_element;
                    console.log(`${this.logPrefix} 🔄 Đổi lần ${changeAttempts} -> ${myElement}`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    console.error(`${this.logPrefix} ❌ Lỗi khi đổi:`, changeData.message || 'Không xác định.');
                    return myElement;
                }
            }

            // ⏳ Hết lượt đổi nhưng vẫn chưa đạt chiến lược
            console.log(`${this.logPrefix} ⚠️ Đã hết MAX_ATTEMPTS (${MAX_ATTEMPTS}). Chấp nhận nguyên tố cuối cùng: ${myElement}`);
            return myElement;
        };

        async getNonceAndRemainingAttacks(url) {
            const logPrefix = '[Hoang Vực]';
            console.log(`${logPrefix} ▶️ Đang tải trang từ ${url}...`);
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const html = await response.text();

                // Regex 1: lấy số lượt đánh
                const attacksMatch = html.match(/<div class="remaining-attacks">Lượt đánh còn lại:\s*(\d+)<\/div>/);
                const remainingAttacks = attacksMatch ? parseInt(attacksMatch[1], 10) : null;

                // Regex 2: lấy nonce
                const nonceMatch = html.match(/var ajax_boss_nonce = '([a-f0-9]+)'/);
                const nonce = nonceMatch ? nonceMatch[1] : null;

                console.log(`${logPrefix} ✅ Lấy dữ liệu thành công.`);
                return { remainingAttacks, nonce };

            } catch (e) {
                console.error(`${logPrefix} ❌ Lỗi khi tải trang hoặc trích xuất dữ liệu:`, e);
                return { remainingAttacks: null, nonce: null };
            }
        }


        /**
         * Hàm chính để tự động hóa Hoang Vực.
         */
        async doHoangVuc() {
            const maximizeDamage = localStorage.getItem('hoangvucMaximizeDamage') === 'true';
            console.log(`${this.logPrefix} ▶️ Bắt đầu nhiệm vụ với chiến lược: ${maximizeDamage ? 'Tối đa hóa Sát thương' : 'Không giảm Sát thương'}.`);
            const hoangVucUrl = `${weburl}hoang-vuc?t`;
            const { remainingAttacks, nonce } = await this.getNonceAndRemainingAttacks(hoangVucUrl);

            if (!nonce) {
                showNotification('Lỗi: Không thể lấy nonce cho Hoang Vực.', 'error');
                throw new Error("Không lấy được nonce");
            }

            const payloadBossInfo = new URLSearchParams();
            payloadBossInfo.append('action', 'get_boss');
            payloadBossInfo.append('nonce', nonce);

            try {
                const bossInfoResponse = await fetch(this.ajaxUrl, {
                    method: 'POST',
                    headers: this.headers,
                    body: payloadBossInfo,
                    credentials: 'include'
                });
                const bossInfoData = await bossInfoResponse.json();

                if (bossInfoData.success) {
                    const boss = bossInfoData.data;

                    if (boss.has_pending_rewards) {
                        await this.claimHoangVucRewards(nonce);
                        return this.doHoangVuc();
                    } else if (boss.created_date === new Date().toISOString().slice(0, 10) && boss.health === boss.max_health) {
                        taskTracker.markTaskDone(accountId, 'hoangvuc');
                        return true;
                    }

                    let myElement = await this.getMyElement();
                    const bossElement = boss.element;

                    // Lấy danh sách các nguyên tố phù hợp
                    const suitableElements = this.getTargetElement(bossElement, maximizeDamage);

                    if (!suitableElements.includes(myElement)) {
                        console.log(`${this.logPrefix} 🔄 Nguyên tố hiện tại (${myElement}) không phù hợp. Đang thực hiện đổi.`);
                        const newElement = await this.changeElementUntilSuitable(myElement, bossElement, maximizeDamage, nonce);

                        if (newElement && suitableElements.includes(newElement)) {
                            myElement = newElement;
                            console.log(`${this.logPrefix} ✅ Đã có được nguyên tố phù hợp: ${myElement}.`);
                        } else {
                            console.log(`${this.logPrefix} ⚠️ Không thể có được nguyên tố phù hợp sau khi đổi. Tiếp tục với nguyên tố hiện tại.`);
                        }
                    } else {
                        console.log(`${this.logPrefix} ✅ Nguyên tố hiện tại (${myElement}) đã phù hợp. Không cần đổi.`);
                    }
                    // Cập nhật số lượt đánh còn lại
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const timePayload = new URLSearchParams();
                    timePayload.append('action', 'get_next_attack_time');
                    const timeResponse = await fetch(this.ajaxUrl, {
                        method: 'POST',
                        headers: this.headers,
                        body: timePayload,
                        credentials: 'include'
                    });
                    const nextAttackTime = await timeResponse.json();

                    if (nextAttackTime.success && Date.now() >= nextAttackTime.data) {
                        // Thực hiện tấn công boss Hoang Vực, nếu thành công và còn 1 lượt tấn công thì đánh dấu nhiệm vụ hoàn thành
                        await new Promise(resolve => setTimeout(resolve, 500));
                        if (await this.attackHoangVucBoss(boss.id, nonce)){
                            taskTracker.adjustTaskTime(accountId, 'hoangvuc', timePlus('15:02'));   //--------- 15 phút cho lần sau -----------//
                            if (remainingAttacks <= 1) {
                            taskTracker.markTaskDone(accountId, 'hoangvuc');
                            };
                        };
                    } else {
                        const remainingTime = nextAttackTime.data - Date.now();
                        const remainingSeconds = Math.floor(remainingTime / 1000);
                        const minutes = Math.floor(remainingSeconds / 60);
                        const seconds = remainingSeconds % 60;
                        const message = `⏳ Cần chờ <b>${minutes} phút ${seconds} giây</b> để tấn công tiếp.`; ///////////////////
                        showNotification(message, 'info');
                        taskTracker.adjustTaskTime(accountId, 'hoangvuc', nextAttackTime.data);
                    }
                } else {
                    const errorMessage = bossInfoData.message || 'Lỗi không xác định khi lấy thông tin boss.';
                    showNotification(errorMessage, 'error');
                }
            } catch (e) {
                console.error(`${this.logPrefix} ❌ Lỗi mạng:`, e);
                showNotification(e.message, 'error');
                throw e;
            }
        }
    }

    // ===============================================
    // LUẬN VÕ
    // ===============================================

    class LuanVo {
        constructor() {
            this.weburl = weburl;
            this.logPrefix = '[Luận Võ]';
        }

        /**
         * Hàm hỗ trợ: Gửi yêu cầu API chung.
         */
        async sendApiRequest(endpoint, method, nonce, body = {}) {
            try {
                const url = `${this.weburl}${endpoint}`;
                const headers = { "Content-Type": "application/json", "X-WP-Nonce": nonce };
                const response = await fetch(url, {
                    method,
                    headers,
                    body: JSON.stringify(body),
                    credentials: 'include'
                });

                const contentType = response.headers.get("content-type");
                let data = null;
                if (contentType && contentType.includes("application/json")) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }

                if (!response.ok) {
                    // vẫn trả về JSON để caller xử lý
                    console.warn(`${this.logPrefix} ⚠️ API trả về lỗi ${response.status}:`, data);
                    return data;
                }

                return data;
            } catch (error) {
                console.error(`${this.logPrefix} ❌ Lỗi khi gửi yêu cầu tới ${endpoint}:`, error);
                return null;
            }
        }

        /**
         * Hàm hỗ trợ: Đợi một khoảng thời gian.
         */
        async delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * Đảm bảo tính năng tự động chấp nhận khiêu chiến được bật.
         */
        async ensureAutoAccept(nonce) {
            if (taskTracker.getTaskStatus(accountId, 'luanvo', 'auto_accept') === true) {
                return true; // Đã bật trước đó
            }
            const toggleEndpoint = 'wp-json/luan-vo/v1/toggle-auto-accept';
            const result1 = await this.sendApiRequest(toggleEndpoint, 'POST', nonce, {});
            if (!result1 || !result1.success) return false;

            if (result1.message.includes('Đã bật')) {
                taskTracker.updateTask(accountId, 'luanvo', 'auto_accept', 'true');
                return true;
            }
            const result2 = await this.sendApiRequest(toggleEndpoint, 'POST', nonce, {});
            if (result2 && result2.success && result2.message.includes('Đã bật'))
                {taskTracker.updateTask(accountId, 'luanvo', 'auto_accept', true);
                return true;
            };
        }

        /**
         * Lấy danh sách tất cả user đang theo dõi
         * Gồm các phần: id, name, avatar, points, auto_accept, can_receive_count, profile_link, role, role_color, description, challenges_remaining, challenge_exists, challenge_id, is_following, is_joined_today, can_send_count, max_batch_count
         */
        async getFollowingUsers(nonce) {
            console.log(`${this.logPrefix} 🕵️ Đang lấy danh sách người theo dõi...`);
            const endpoint = 'wp-json/luan-vo/v1/get-following-users';
            const body = { page: 1 };
            const data = await this.sendApiRequest(endpoint, 'POST', nonce, body);

            if (data && data.success) {
                console.log(`${this.logPrefix} ✅ Lấy danh sách thành công. Tìm thấy ${data.data.users.length} người dùng.`);
                return data.data.users
            } else {
                const message = data?.message || 'Lỗi không xác định khi lấy danh sách người theo dõi.';
                console.error(`${this.logPrefix} ❌ ${message}`);
                return null;
            }
        };

        /**
         * Lấy danh sách tất cả user đang theo dõi
         * Gồm các phần: id, name, avatar, points, auto_accept, can_receive_count, profile_link, role, role_color, description, challenges_remaining, challenge_exists, challenge_id, is_following, is_joined_today, can_send_count, max_batch_count
         */
        async  getOnlineUsers(nonce) {
            console.log("🟢 Đang lấy danh sách người dùng online...");
            const endpoint = 'wp-json/luan-vo/v1/online-users';
            const body = { page: 1 };

            const data = await this.sendApiRequest(endpoint, 'POST', nonce, body);
            if (data && data.success) {
                console.log(`✅ Lấy danh sách thành công. Tìm thấy ${data.data.users.length} người online.`);
                return data.data.users; // trả nguyên danh sách
            } else {
                const message = data?.message || "Lỗi không xác định khi lấy danh sách người dùng online.";
                console.error(`❌ ${message}`);
                return null;
            };
        };

        /**
         * Gửi yêu cầu khiêu chiến đến một người chơi cụ thể.
         */
        async sendChallenge(userId, nonce) {
            console.log(`${this.logPrefix} 🎯 Đang gửi khiêu chiến đến người chơi ID: ${userId}...`);
            const challengeMode = localStorage.getItem('luanVoChallengeMode') || 'auto';

            const sendEndpoint = 'wp-json/luan-vo/v1/send-challenge';
            const sendBody = { target_user_id: userId };
            const sendResult = await this.sendApiRequest(sendEndpoint, 'POST', nonce, sendBody);

            if (sendResult && sendResult.success) {
                console.log(`${this.logPrefix} 🎉 Gửi khiêu chiến thành công! Challenge ID: ${sendResult.data.challenge_id}`);

                // Bước mới: Kiểm tra nếu đối thủ bật auto_accept
                if (sendResult.data.auto_accept || challengeMode === 'manual') {
                    console.log(`${this.logPrefix} ✨ Đối thủ tự động chấp nhận, đang hoàn tất trận đấu...`);

                    const approveEndpoint = 'wp-json/luan-vo/v1/auto-approve-challenge';
                    const approveBody = {
                        challenge_id: sendResult.data.challenge_id,
                        target_user_id: userId
                    };

                    const approveResult = await this.sendApiRequest(approveEndpoint, 'POST', nonce, approveBody);

                    if (approveResult && approveResult.success) {
                        showNotification(`[Luận võ] ${approveResult.data.message}!`, 'success');
                        return true;
                    } else {
                        const message = approveResult?.data?.message || 'Lỗi không xác định khi hoàn tất trận đấu.';
                        showNotification(`❌ Lỗi hoàn tất trận đấu: ${message}`, 'error');
                        return false;
                    }
                } else {
                    showNotification(`✅ Đã gửi khiêu chiến đến ${userId}! Đang chờ đối thủ chấp nhận.`, 'success');
                    return true;
                }
            } else {
                const message = sendResult?.data?.message || 'Lỗi không xác định.';
                showNotification(`❌ Gửi khiêu chiến thất bại: ${message}`, 'error');
                return false;
            }
        }

        /**
         * Hiện hộp thoại và chuyển hướng đến trang Luận Võ trên tab hiện tại.
         */
        async goToLuanVoPage() {
            const luanVoUrl = `${weburl}/luan-vo-duong?t`;

            if (confirm("Bạn có muốn chuyển đến trang Luận Võ Đường không?")) {
                window.location.href = luanVoUrl;
            }
        }


        /**
         * Gửi yêu cầu nhận thưởng Luận Võ và xử lý phản hồi từ server.
         * @param {string} nonce - Nonce bảo mật của phiên làm việc.
         */
        async receiveReward(nonce) {
            console.log(`${this.logPrefix} 🎁 Đang gửi yêu cầu nhận thưởng...`);

            const shouldJoinBattle = localStorage.getItem('luanVoJoinBattle') === '1';
            const endpoint = 'wp-json/luan-vo/v1/receive-reward';
            const body = {};

            try {
                const response = await this.sendApiRequest(endpoint, 'POST', nonce, body);
                if (!response) {
                    return;
                }
                if (response.success === true) {
                    showNotification(`🎉 Luận võ: ${response.message}`, 'success');
                    taskTracker.markTaskDone(accountId, 'luanvo');
                    return;
                } else if (response.message === "Đạo hữu đã nhận thưởng trong ngày hôm nay.") {
                    showNotification('🎁 Bạn đã nhận thưởng Luận Võ hôm nay rồi!', 'info')
                    taskTracker.markTaskDone(accountId, 'luanvo');
                    return;
                } else {
                    const errorMessage = response.message || 'Lỗi không xác định khi nhận thưởng.';
                    showNotification(`❌ ${errorMessage}`, 'error');
                }
            } catch (error) {
                showNotification(`❌ Lỗi mạng khi gửi yêu cầu nhận thưởng. ${error}`, 'error');
            }
        }
        /**
         * Hàm chính: Chạy toàn bộ quy trình Luận Võ.
         */
        async startLuanVo(nonce) {
            const shouldJoinBattle = localStorage.getItem('luanVoJoinBattle') === '1';
            const shouldEnableAutoAccept = localStorage.getItem('luanVoEnableAutoAccept') === '1';
            
            // ⭐ BƯỚC 2: THAM GIA LUẬN VÕ (Tuỳ chọn)
            if (shouldJoinBattle) {
                const securityToken = await getSecurityToken(weburl + 'luan-vo-duong?t');
                
                if (!taskTracker.getTaskStatus(accountId, 'luanvo').battle_joined) {
                    const joinResult = await this.sendApiRequest(
                        'wp-json/luan-vo/v1/join-battle', 'POST', nonce, {action: 'join_battle', security_token: securityToken}
                    );
                    if (joinResult && joinResult.success === true) {
                        console.log(`✅ Tham gia luận võ thành công.`);
                        taskTracker.updateTask(accountId, 'luanvo', 'battle_joined', true);
                    } else if (joinResult.message === 'Bạn đã tham gia Luận Võ Đường hôm nay rồi!') {
                        console.log(`✅ Đã tham gia luận võ trước đó.`);
                        taskTracker.updateTask(accountId, 'luanvo', 'battle_joined', true);
                    } else {
                        showNotification('Lỗi máy chủ hoặc lỗi mạng khi tham gia luận võ', 'error');
                    }
                } else {
                    console.log(`${this.logPrefix} Đã tham gia luận võ trước đó.`);
                }
            } else {
                console.log(`${this.logPrefix} ⏭️ Bỏ qua bước tham gia luận võ (theo cài đặt).`);
            }

            // ⭐ BƯỚC 3: BẬT TỰ ĐỘNG CHẤP NHẬN (Tuỳ chọn)
            if (shouldEnableAutoAccept) {
                if (!taskTracker.getTaskStatus(accountId, 'luanvo').auto_accept) {
                    const autoAcceptSuccess = await this.ensureAutoAccept(nonce);
                    if (!autoAcceptSuccess) {
                        showNotification('⚠️ Không thể bật tự động chấp nhận.', 'warn');
                    } else {
                        console.log(`${this.logPrefix} ✅ Tự động chấp nhận đã được bật.`);
                    }
                }
            } else {
                console.log(`${this.logPrefix} ⏭️ Bỏ qua bước bật tự động chấp nhận (theo cài đặt).`);
            }
        }
        async doLuanVo(autoChallenge) {

            const nonce = await getNonce();
            if (!nonce) {
                showNotification(' Lỗi: Không thể❌ lấy nonce cho Luận Võ.', 'error');
                return;
            }

            // ⭐ ĐỌC CÀI ĐẶT TỪ LOCALSTORAGE
            const challengeMode = localStorage.getItem('luanVoChallengeMode') || 'auto';
            const targetUserId = localStorage.getItem('luanVoTargetUserId') || '';                       
            
            // ⭐ BƯỚC 4: KHIÊU CHIẾN
            if (!autoChallenge) {
                //Hiện hộp thoại thông báo để người chơi tới trang luận võ thủ công
                this.goToLuanVoPage();
                return;
            }

            // ⭐ CHẾ ĐỘ THƯỜNG: Tự động chọn đối thủ
            if (challengeMode === 'auto') {
                console.log(`${this.logPrefix} 🤖 Chế độ: Tự động chọn đối thủ`);
                
                // Vòng lặp gửi khiêu chiến (logic cũ)
                let shouldAttackOnline = false;

                while (true) {
                    let allFollowingUsers = await this.getFollowingUsers(nonce);

                    // Nếu không có dữ liệu thì coi như rỗng
                    if (!Array.isArray(allFollowingUsers) || allFollowingUsers.length === 0) {
                        console.log("⚠️ Không có user nào trong danh sách theo dõi.");
                        shouldAttackOnline = true; // chuyển sang attack online luôn
                    }

                    let myCanSend = allFollowingUsers?.[0]?.can_send_count ?? 5;
                    console.log(`🔄 Vòng lặp khiêu chiến mới. Lượt có thể gửi: ${myCanSend}`);
                    if (myCanSend <= 0) break;

                    if (!shouldAttackOnline) {
                        // Lọc những user có thể khiêu chiến (auto_accept + còn lượt)
                        let canChallengeUsers = (allFollowingUsers || []).filter(u => u.auto_accept && u.can_receive_count > 0);
                        console.log(`👥 Tìm thấy ${canChallengeUsers.length} người theo dõi có thể khiêu chiến (auto_accept + còn lượt).`);
                        if (canChallengeUsers.length > 0) {
                            // Khiêu chiến user đầu tiên
                            console.log(`🎯 Chuẩn bị khiêu chiến với user ID: ${canChallengeUsers[0].id}`);
                            const success = await this.sendChallenge(canChallengeUsers[0].id, nonce);
                            if (success) {
                                myCanSend--;
                                await this.delay(4500);
                            }
                            continue; // quay lại kiểm tra following
                        }

                        // Nếu không còn ai có auto_accept, kiểm tra những người còn lượt
                        let canReceiveUsers = (allFollowingUsers || []).filter(u => u.can_receive_count > 0);
                        if (canReceiveUsers.length === 0) {
                            shouldAttackOnline = true;
                        } else break;
                    }

                    // Nếu không còn ai để khiêu chiến từ following và user đồng ý, tấn công online
                    if (shouldAttackOnline) {
                        while (myCanSend > 0) {
                            let allOnlineUsers = await this.getOnlineUsers(nonce);
                            if (!Array.isArray(allOnlineUsers) || allOnlineUsers.length === 0) break;

                            const success = await this.sendChallenge(allOnlineUsers[0].id, nonce);
                            if (success) {
                                myCanSend--;
                                await this.delay(4500);
                            }
                        }
                        break; // xong attack online thì thoát vòng lặp
                    }

                    // Nếu vẫn còn lượt nhưng không ai để khiêu chiến, dừng vòng lặp
                    if (myCanSend <= 0) break;
                }
            } 
            // ⭐ CHẾ ĐỘ MỚI: Khiêu chiến theo ID cụ thể
            else if (challengeMode === 'manual') {
                console.log(`${this.logPrefix} 🎯 Chế độ: Khiêu chiến theo ID cụ thể`);
                
                if (!targetUserId) {
                    showNotification('❌ Chưa cài đặt ID người chơi để khiêu chiến!', 'error');
                    return;
                }

                // Lấy thông tin lượt còn lại
                let allFollowingUsers = await this.getFollowingUsers(nonce);
                let myCanSend = allFollowingUsers?.[0]?.can_send_count ?? 5;
                
                console.log(`🎯 Sẽ khiêu chiến user ID: ${targetUserId} (Còn ${myCanSend} lượt)`);
                
                // Vòng lặp khiêu chiến cùng 1 người
                while (myCanSend > 0) {
                    console.log(`🔄 Đang gửi khiêu chiến đến ${targetUserId}... (Còn ${myCanSend} lượt)`);
                    
                    const success = await this.sendChallenge(targetUserId, nonce);
                    
                    if (success) {
                        myCanSend--;
                        
                        if (myCanSend > 0) {
                            await this.delay(4500); // Delay giữa các lần khiêu chiến
                        }
                    } else {
                        // Nếu thất bại, có thể đối thủ hết lượt hoặc lỗi khác
                        console.warn(`⚠️ Không thể khiêu chiến ${targetUserId}. Dừng lại.`);
                        break;
                    }
                }
                
                console.log(`✅ Hoàn thành khiêu chiến theo ID. Đã gửi ${5 - myCanSend} lượt.`);
            }

            // Bước 5: Nhận thưởng nếu có
            const rewardResult = await this.receiveReward(nonce);
        }
        /**Thuê Tiêu Viêm để hoàn thành khiêu chiến */
        async thueTieuViem() {
            const nonce = await getNonce();
            if (!nonce) {
                showNotification('❌ Lỗi: Không thể lấy nonce cho Luận Võ.', 'error');
                return;
            }

            try {
                while (true) {
                    const res = await fetch(weburl + "wp-json/luan-vo/v1/send-bot-challenge", {
                        method: "POST",
                        credentials: "include",
                        headers: {
                            "Content-Type": "application/json",
                            "X-WP-Nonce": nonce
                        },
                        body: JSON.stringify({ bot_id: -1 })
                    });

                    if (!res.ok) {
                        console.error("❌ Request thất bại:", res.status);
                        break;
                    }

                    const data = await res.json();
                    if (data.success) {
                        showNotification(data.message, 'success');
                    } else if (data.message === "Đạo hữu đã đạt tối đa nhận khiêu chiến trong ngày.") {
                        showNotification('[Luận võ] Hoàn thành khiêu chiến Viêm Trẩu', 'info');
                        break;
                    }
                    // chờ 1-2 giây để tránh spam quá nhanh
                    await new Promise(r => setTimeout(r, 1500));
                }
            } catch (error) {
                console.error("❌ Lỗi:", error);
            }
        }
    };

    class KhoangMach {
        constructor() {
            this.ajaxUrl = ajaxUrl;
            this.khoangMachUrl = weburl + 'khoang-mach?t';
            this.logPrefix = '[Khoáng Mạch]';
            this.headers = {
                "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                "X-Requested-With": "XMLHttpRequest",
            };
            this.getUsersInMineNonce = null;
            this.securityToken = null;
            this.buffBought = false;
            this.MINE_DATA_API_URL = 'https://script.google.com/macros/s/AKfycbxJoJniBQP6JHLpSHbLwYqmoihZj0YZ9qIWp9LsJoJOCANJPTiu7s8_6v9ecVZjtD40/exec';
        }

        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        async #getNonce(regex) {
            return getSecurityNonce(this.khoangMachUrl, regex);
        }


        async loadMines(mineType) {
            const nonce = await getSecurityNonce(this.khoangMachUrl, /action:\s*'load_mines_by_type',\s*mine_type:\s*mineType,[\s\S]*?security:\s*'([a-f0-9]+)'/);
            if (!nonce) { showNotification('Lỗi nonce (load_mines).', 'error'); return null; }
            const payload = new URLSearchParams({ action: 'load_mines_by_type', mine_type: mineType, security: nonce });
            try {
                const r = await fetch(this.ajaxUrl, { method: 'POST', headers: this.headers, body: payload, credentials: 'include' });
                const d = await r.json();
                return d.success ? d.data : (showNotification(d.message || 'Lỗi tải mỏ.', 'error'), null);
            } catch (e) { console.error(`${this.logPrefix} ❌ Lỗi mạng (tải mỏ):`, e); return null; }
        };

        async getAllMines() {
            const cacheKey = "HH3D_allMines";
            const cacheRaw = localStorage.getItem(cacheKey);

            // Kiểm tra cache
            if (cacheRaw && cacheRaw.length > 0) {
                try {
                    const cache = JSON.parse(cacheRaw);
                    if (Date.now() < cache.expiresAt && cache.data && cache.data.length > 0) {
                        console.log("[HH3D] 🗄️ Dùng dữ liệu mỏ từ cache");
                        return {
                            optionsHtml: cache.optionsHtml,
                            minesData: cache.data
                        };
                    } else {
                        localStorage.removeItem(cacheKey);
                    }
                } catch (e) {
                    console.warn("[HH3D] Lỗi đọc cache:", e);
                }
            }

            // --- Nếu chưa có cache hoặc đã hết hạn, tải mới ---
            const nonce = await getSecurityNonce(
                this.khoangMachUrl,
                /action:\s*'load_mines_by_type',\s*mine_type:\s*mineType,[\s\S]*?security:\s*'([a-f0-9]+)'/
            );
            if (!nonce) {
                showNotification('Lỗi nonce (getAllMines).', 'error');
                return { optionsHtml: '', minesData: [] };
            }

            const mineTypes = ['gold', 'silver', 'copper'];
            const allMines = [];

            // Tải song song cho nhanh
            const requests = mineTypes.map(async type => {
                const payload = new URLSearchParams({
                    action: 'load_mines_by_type',
                    mine_type: type,
                    security: nonce
                });

                try {
                    const r = await fetch(this.ajaxUrl, {
                        method: 'POST',
                        headers: this.headers,
                        body: payload,
                        credentials: 'include'
                    });
                    const d = await r.json();

                    if (d.success) {
                        d.data.forEach(mine => {
                            mine.type = type;
                            allMines.push(mine);
                        });
                    } else {
                        showNotification(d.message || `Lỗi tải mỏ loại ${type}.`, 'error');
                    }
                } catch (e) {
                    console.error(`${this.logPrefix} ❌ Lỗi mạng (tải mỏ ${type}):`, e);
                }
            });

            await Promise.all(requests);

            // --- Sắp xếp ---
            allMines.sort((a, b) => {
                const typeOrder = { 'gold': 1, 'silver': 2, 'copper': 3 };
                const typeComparison = typeOrder[a.type] - typeOrder[b.type];
                if (typeComparison === 0) {
                    return a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' });
                }
                return typeComparison;
            });

            // --- Sinh HTML ---
            const mineOptionsHtml = allMines.map(mine => {
                let typePrefix = '';
                if (mine.type === 'gold') typePrefix = '[Thượng] ';
                else if (mine.type === 'silver') typePrefix = '[Trung] ';
                else if (mine.type === 'copper') typePrefix = '[Hạ] ';
                return `<option value="${mine.id}">${typePrefix}${mine.name} (${mine.id})</option>`;
            }).join('');

            // --- Tính thời điểm 0h hôm sau ---
            const now = new Date();
            const expireDate = new Date(now);
            expireDate.setHours(24, 0, 0, 0); // 0h ngày hôm sau
            const expiresAt = expireDate.getTime();

            // --- Lưu cache ---
            localStorage.setItem(cacheKey, JSON.stringify({
                data: allMines,
                optionsHtml: mineOptionsHtml,
                expiresAt
            }));

            return {
                optionsHtml: mineOptionsHtml,
                minesData: allMines
            };
        }


        async enterMine(mineId) {
            // Lấy nonce
            const nonce = await this.#getNonce(/action: 'enter_mine',\s*mine_id:\s*mine_id,[\s\S]*?security: '([a-f0-9]+)'/);
            if (!nonce) {
                showNotification('Lỗi nonce (enter_mine).', 'error');
                return false;
            }

            if (!nonce) {
                showNotification('Lỗi nonce (enter_mine).', 'error');
                return false;
            }

            // Hàm gửi request
            const post = async (payload) => {
                const r = await fetch(this.ajaxUrl, {
                    method: 'POST',
                    headers: this.headers,
                    body: new URLSearchParams(payload),
                    credentials: 'include'
                });
                return r.json();
            };
            this.securityToken = await getSecurityToken(this.khoangMachUrl);
            try {
                const d = await post({ action: 'enter_mine', mine_id: mineId, security_token: this.securityToken, security: nonce });

                if (d.success) {
                    showNotification(d.data.message, 'success');
                    return true;
                }

                const msg = d.data.message || 'Lỗi vào mỏ.';

                if (msg.includes('đạt đủ thưởng ngày')) {
                    taskTracker.markTaskDone(accountId, 'khoangmach');
                    showNotification(msg, 'error');
                }
                else if (msg.includes('Có phần thưởng chưa nhận')) {
                    // Nếu bị sát hại tại khoáng mạch → nhận thưởng trước
                    const nonce = await this.#getNonce(/action: 'claim_reward_km',[\s\S]*?security: '([a-f0-9]+)'/);
                    if (!nonce) {
                        showNotification('Lỗi nonce (claim_reward_km).', 'error');
                        return false;
                    }
                    this.securityToken = await getSecurityToken(this.khoangMachUrl);
                    const reward = await post({ action: 'claim_reward_km', security_token: this.securityToken, security: nonce });
                    if (reward.success) {
                        showNotification(`Nhận thưởng <b>${reward.data.total_tuvi} tu vi và ${reward.data.total_tinh_thach} tinh thạch</b> tại khoáng mạch ${reward.data.mine_name}`, 'info');
                        return this.enterMine(mineId); // gọi lại để vào mỏ
                    } else {
                        showNotification('Lỗi nhận thưởng khi bị đánh ra khỏi mỏ khoáng', 'warn');
                    }
                }

            } catch (e) {
                console.error(`${this.logPrefix} ❌ Lỗi mạng (vào mỏ):`, e);
                return false;
            }
        }

        async getUsersInMine(mineId) {

            // --- 1. Lấy 'security' nonce (giữ logic cache của bạn) ---
            let nonce = '';
            if (this.getUsersInMineNonce) {
                nonce = this.getUsersInMineNonce;
                console.log(`${this.logPrefix} 🗄️ Dùng 'security' nonce từ cache.`);
            } else {
                console.log(`${this.logPrefix} ▶️ Cache nonce không có, tải mới...`);
                // Giả định this.#getNonce là hàm private của class bạn
                nonce = await this.#getNonce(/action:\s*'get_users_in_mine',[\s\S]*?security:\s*'([a-f0-9]+)'/);

                if (nonce) {
                    this.getUsersInMineNonce = nonce; // lưu lại để dùng lần sau
                }
            }
            this.securityToken = await getSecurityToken(this.khoangMachUrl);
            // --- 3. Kiểm tra cả hai token ---
            if (!nonce || !this.securityToken) {
                let errorMsg = 'Lỗi (get_users):';
                if (!nonce) errorMsg += " Không tìm thấy 'security' nonce.";
                if (!this.securityToken) errorMsg += " Không tìm thấy 'security_token' (hh3dData).";

                showNotification(errorMsg, 'error');
                this.getUsersInMineNonce = null; // Xóa cache nonce hỏng nếu có
                return null;
            }

            // --- 4. Tạo payload (Đã thêm security_token) ---
            const payload = new URLSearchParams({
                action: 'get_users_in_mine',
                mine_id: mineId,
                security_token: this.securityToken, // <-- THÊM DÒNG NÀY
                security: nonce
            });

            // --- 5. Gửi fetch ---
            try {
                const r = await fetch(this.ajaxUrl, { method: 'POST', headers: this.headers, body: payload, credentials: 'include' });
                const d = await r.json();

                // Logic trả về của bạn (hoạt động tốt)
                return d.success ? d.data : (showNotification(d.data.message || 'Lỗi lấy thông tin người chơi.', 'error'), null);

            } catch (e) {
                console.error(`${this.logPrefix} ❌ Lỗi mạng (lấy user):`, e);
                return null;
            }
        }

        async takeOverMine(mineId) {
            const nonce = await this.#getNonce(/action: 'change_mine_owner',\s*mine_id:\s*mineId,[\s\S]*?security: '([a-f0-9]+)'/);
            if (!nonce) { showNotification('Lỗi nonce (take_over).', 'error'); return false; }
            this.securityToken = await getSecurityToken(this.khoangMachUrl);
            const payload = new URLSearchParams({ action: 'change_mine_owner', mine_id: mineId, security_token: this.securityToken, security: nonce });
            try {
                const r = await fetch(this.ajaxUrl, { method: 'POST', headers: this.headers, body: payload, credentials: 'include' });
                const d = await r.json();
                if (d.success) {
                    showNotification(d.data.message, 'success');
                    return true;
                } else {
                    showNotification(d.message || 'Lỗi đoạt mỏ.', 'error');
                    return false;
                }
            } catch (e) { console.error(`${this.logPrefix} ❌ Lỗi mạng (đoạt mỏ):`, e); return false; }
        }

        async buyBuffItem() {
            const nonce = await this.#getNonce(/action: 'buy_item_khoang',[\s\S]*?security: '([a-f0-9]+)'/);
            if (!nonce) { showNotification('Lỗi nonce (buy_item).', 'error'); return false; }
            const payload = new URLSearchParams({ action: 'buy_item_khoang', security: nonce, item_id: 4 });
            try {
                const r = await fetch(this.ajaxUrl, { method: 'POST', headers: this.headers, body: payload, credentials: 'include' });
                const d = await r.json();
                if (d.success) {
                    showNotification(d.data.message || 'Đã mua Linh Quang Phù', 'success');
                    this.buffBought = true;
                    return true;
                } else {
                    showNotification(d.data.message || 'Lỗi mua Linh Quang Phù', 'error');
                    return false;
                }
            } catch (e) { console.error(`${this.logPrefix} ❌ Lỗi mạng (mua buff):`, e); return false; }
        }

        async claimReward(mineId) {
            const leaveMineToClaimReward = localStorage.getItem(`khoangmach_leave_mine_to_claim_reward_${accountId}`) === 'true';
            if (leaveMineToClaimReward) {
                const left = await this.leaveMine(mineId);
                if (!left) {
                    showNotification('Không thể rời mỏ để nhận thưởng.', 'error');
                    return false;
                } else {
                    await this.delay(500); // đợi 1s cho chắc
                    const entered = await this.enterMine(mineId);
                    if (!entered) {
                        showNotification('Không thể vào lại mỏ sau khi nhận thưởng.', 'error');
                        return false;
                    } else {
                        taskTracker.adjustTaskTime(accountId, 'khoangmach', timePlus('30:00'));
                        return true;
                    }
                }
            } else {
                const nonce = await this.#getNonce(/action: 'claim_mycred_reward',\s*mine_id:\s*mine_id,[\s\S]*?security: '([a-f0-9]+)'/);
                if (!nonce) { showNotification('Lỗi nonce (claim_reward).', 'error'); return false; }
                this.securityToken = await getSecurityToken(this.khoangMachUrl);
                const payload = new URLSearchParams({ action: 'claim_mycred_reward', mine_id: mineId, security_token:this.securityToken, security: nonce });
                try {
                    const r = await fetch(this.ajaxUrl, { method: 'POST', headers: this.headers, body: payload, credentials: 'include' });
                    const d = await r.json();
                    if (d.success) {
                        showNotification(d.data.message, 'success');
                        taskTracker.adjustTaskTime(accountId, 'khoangmach', timePlus('30:00'));
                        return true;
                    } else {
                        showNotification(d.data.message || 'Lỗi nhận thưởng.', 'error');
                        return false;
                    }
                } catch (e) { console.error(`${this.logPrefix} ❌ Lỗi mạng (nhận thưởng):`, e); return false; }
            }
        }


        async attackUser(userId, mineId) {
            const security= await this.#getNonce(/action:\s*'attack_user_in_mine'[\s\S]*?security:\s*'([a-f0-9]+)'/);
            const securityToken = await getSecurityToken(this.khoangMachUrl);
            if (!security ) {
                showNotification('Lỗi nonce (attack_user_in_mine).', 'error');
                return false;
            }
            const payload = new URLSearchParams({ action: 'attack_user_in_mine',  target_user_id: userId,  mine_id: mineId, security_token: securityToken, security: security});
            try {
                const r = await fetch(this.ajaxUrl, { method: 'POST', headers: this.headers, body: payload, credentials: 'include' });
                const d = await r.json();
                if (d.success) {
                    showNotification(d.data.message || 'Đã tấn công người chơi.', 'success');
                    return true;
                } else {
                    showNotification(d.data.message || 'Lỗi tấn công người chơi.', 'error');
                    return false;
                }
            } catch (e) { console.error(`${this.logPrefix} ❌ Lỗi mạng (tấn công user):`, e); return false; }
        }

        async leaveMine(mineId) {
            const nonce = await this.#getNonce(/action: 'leave_mine',[\s\S]*?security: '([a-f0-9]+)'/);
            if (!nonce) { showNotification('Lỗi nonce (leave_mine).', 'error'); return false; }
            this.securityToken = await getSecurityToken(this.khoangMachUrl);
            const payload = new URLSearchParams({ action: 'leave_mine', mine_id: mineId, security_token: this.securityToken, security: nonce });
            try {
                const r = await fetch(this.ajaxUrl, { method: 'POST', headers: this.headers, body: payload, credentials: 'include' });
                const d = await r.json();
                if (d.success) {
                    showNotification(d.data.message, 'success');
                    return true;
                } else {
                    showNotification(d.message || 'Lỗi rời mỏ.', 'error');
                    return false;
                }
            } catch (e) { console.error(`${this.logPrefix} ❌ Lỗi mạng (rời mỏ):`, e); return false; }
        }

        async doKhoangMach() {
            const selectedMineSetting = localStorage.getItem(`khoangmach_selected_mine_${accountId}`);
            if (!selectedMineSetting) {
                showNotification('Vui lòng chọn một mỏ trong cài đặt.', 'error');
                throw new Error ('Bạn chưa chọn mỏ');
            }

            const selectedMineInfo = JSON.parse(selectedMineSetting);
            if (!selectedMineInfo || !selectedMineInfo.id || !selectedMineInfo.type) {
                showNotification('Cài đặt mỏ không hợp lệ.', 'error');
                throw new Error ('Cài đặt mỏ không hợp lệ.');
            }

            const useBuff = localStorage.getItem('khoangmach_use_buff') === 'true';
            const autoTakeover = localStorage.getItem('khoangmach_auto_takeover') === 'true';
            const autoTakeoverRotation = localStorage.getItem('khoangmach_auto_takeover_rotation') === 'true';
            const rewardMode = localStorage.getItem('khoangmach_reward_mode') || 'any';
            const rewardTimeSelected = localStorage.getItem('khoangmach_reward_time');
            const rewardTime = rewardTimeSelected;
            const outerNotification = localStorage.getItem('khoangmach_outer_notification') === 'true';

            this.securityToken = await getSecurityToken(this.khoangMachUrl);
            if (!this.securityToken) {
                showNotification('Lỗi: Không lấy được security_token cho khoáng mạch.', 'error');
                throw new Error ('Không lấy được security_token cho khoáng mạch.');
            }
            console.log(`${this.logPrefix} Bắt đầu quy trình cho mỏ ID: ${selectedMineInfo.id}.`);
            const mines = await this.loadMines(selectedMineInfo.type);
            if (!mines) throw new Error ('Không tải danh sách khoáng mạch được');

            const targetMine = mines.find(m => m.id === selectedMineInfo.id);
            if (!targetMine) {
                showNotification('Không tìm thấy mỏ đã chọn trong danh sách tải về.', 'error');
                throw new Error ('Không tìm thấy mỏ đã chọn trong danh sách.');
            }
            if (!targetMine.is_current) {
                if (parseInt(targetMine.user_count) >= parseInt(targetMine.max_users)) {
                    showNotification('Mỏ đã đầy. Không vào được.', 'warn');
                    return true;
                } else {
                    await this.enterMine(targetMine.id);
                    return true;
                }
            }

            // Bắt đầu vòng lặp để kiểm tra và thực hiện tác vụ liên tục
            while (true) {
                // Kiểm tra thông tin trong mỏ
                let mineInfo = await this.getUsersInMine(targetMine.id);
                if (!mineInfo) throw new Error('Lỗi lấy thông tin chi tiết trong mỏ');
                const users = mineInfo.users || [];
                if (users.length === 0) {
                    console.log(`[Khoáng mạch] Mỏ ${targetMine.id} trống.`);
                    throw new Error('Mỏ trống trơn???');
                }


                // Kiểm tra vị trí trong mỏ
                let myIndex = users.findIndex(u => u.id.toString() === accountId.toString());
                if (myIndex === -1) {
                    console.log(`[Khoáng mạch] Kiểm tra vị trí. Bạn chưa vào mỏ ${targetMine.name}.`);
                    return true;
                }

                // Kiểm tra ngoại tông
                let outer = users.some(u => !u.lien_minh && !u.dong_mon);
                if (outer && outerNotification) {
                    // Thông báo nếu vẫn còn ngoại tông
                    if (confirm('Ngoại tông xâm nhập khoáng mạch, \n Bạn có muốn đến khoáng mạch?')){
                        window.location.href = this.khoangMachUrl;
                    }
                }


                let myInfo = users[myIndex];
                console.log(`[Khoáng mạch] Vị trí: ${myIndex}, Tên: ${myInfo.name}, Time: ${myInfo.time_spent}`);

                // Kiểm tra thời gian
                if (myInfo.time_spent !== "Đạt tối đa") {
                    const timeMatch = myInfo.time_spent.match(/(\d+)\s*phút/);
                    const minutesSpent = timeMatch ? parseInt(timeMatch[1]) : 0;

                    let shouldWait = false;
                    let nextTime = null;

                    if (rewardTimeSelected === 'max') {
                        // Chờ đến khi đạt tối đa (30 phút)
                        shouldWait = true;
                        nextTime = Date.now() + Math.max(30*60*1000 - (minutesSpent * 60 * 1000), 0);
                        showNotification(`Khoáng mạch chưa đủ thời gian.<br>Hiện đạt: <b>${myInfo.time_spent}</b><br>Cần: <b>Đạt tối đa</b>`, 'warn');
                    } else {
                        // Kiểm tra với thời gian cụ thể
                        const requiredMinutes = parseInt(rewardTimeSelected);
                        if (minutesSpent < requiredMinutes) {
                            shouldWait = true;
                            nextTime = Date.now() + Math.max((requiredMinutes - minutesSpent) * 60 * 1000, 0);
                            showNotification(`Khoáng mạch chưa đủ thời gian.<br>Hiện đạt: <b>${myInfo.time_spent}</b><br>Cần: <b>${requiredMinutes} phút</b>`, 'warn');
                        }
                    }

                    if (shouldWait) {
                        taskTracker.adjustTaskTime(accountId, 'khoangmach', nextTime);
                        break;
                    }
                }

                // Kiểm tra trạng thái bonus
                let bonus = mineInfo.bonus_percentage || 0;
                let canClaim = false;
                if (rewardMode === "any") {
                    canClaim = true;
                } else if (rewardMode === "20" && bonus >= 20) {
                    canClaim = true;
                } else if (rewardMode === "100" && bonus >= 100) {
                    canClaim = true;
                } else if (rewardMode === "110" && bonus === 110) {
                    canClaim = true;
                }

                if (canClaim) {
                    console.log(`[Khoáng mạch] Nhận thưởng tại mỏ ${targetMine.id}, bonus=${bonus}%`);
                    await this.claimReward(targetMine.id);  // Nhận thưởng
                    break; // Thoát vòng lặp sau khi nhận thưởng
                } else {
                    console.log(`[Khoáng mạch] Bonus tu vi ${bonus}% chưa đạt ngưỡng ${rewardMode}`);

                    // Nếu có thể, thử takeover trước (option đoạt mỏ khi chưa buff)
                    if (autoTakeover && mineInfo.can_takeover) {
                        await this.delay(500);
                        console.log(`[Khoáng mạch] Thử đoạt mỏ ${targetMine.id}...`);
                        await this.takeOverMine(targetMine.id);
                        continue;
                    }

                    // Nếu có thể, thử takeover trước (option đoạt mỏ bất kể buff)
                    if (autoTakeoverRotation && mineInfo.can_takeover) {
                        await this.delay(500);
                        console.log(`[Khoáng mạch] Thử đoạt mỏ ${targetMine.id}...`);
                        await this.takeOverMine(targetMine.id);
                        continue;
                    }

                    // Nếu có chọn mua buff
                    if (useBuff && bonus > 20 && !this.buffBought) {
                        await this.delay(500);
                        console.log(`[Khoáng mạch] Mua linh quang phù...`);
                        await this.buyBuffItem(targetMine.id);
                        // Đợi một chút để server xử lý
                        await new Promise(resolve => setTimeout(resolve, 300));
                        continue;
                    }



                    // Nếu không thể làm gì, thoát khỏi vòng lặp
                    showNotification(`[Khoáng mạch] Bonus ${bonus}% chưa đạt ${rewardMode}%<br>Hiện không thể đoạt mỏ.<br>Không thực hiện được hành động nào.`, 'info')
                    break;
                }
            }
        }

        /**
         * Lấy danh sách tổng môn
         * @returns {Promise<Array<{id: string, name: string, level: number}>>} Mảng đối tượng tổng môn
         * ví dụ: [{id: "123", name: "Tông Môn A", level: 6}, ...]
         */
        async getListTongMon() {
            try {
                // 1. SỬA LỖI LOGIC URL: 
                // Dùng đường dẫn tương đối "/" để tự động lấy domain hiện tại.
                // Không cần biến "weburl" (tránh lỗi weburl is not defined).
                const response = await fetch("/danh-sach-cac-tong-mon-tai-hoathinh3d");

                // Kiểm tra trạng thái HTTP
                if (!response.ok) {
                    throw new Error(`Lỗi kết nối: ${response.status} ${response.statusText}`);
                }

                // 2. Chuyển đổi dữ liệu
                const htmlText = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, "text/html");
                
                // Chọn danh sách hàng
                const rows = doc.querySelectorAll('table.bxh-page tbody tr');
                const results = [];

                rows.forEach(row => {
                    // Lấy nút tham gia để trích xuất ID
                    const btn = row.querySelector('button.join-group');
                    const id = btn ? btn.getAttribute('data-group-id') : null;

                    // Lấy khu vực tên
                    const nameDiv = row.querySelector('.display-container.group-name');

                    // 3. SỬA LỖI LOGIC PARSE TÊN:
                    // Chỉ xử lý khi có đủ ID và Tên
                    if (nameDiv && id) {
                        let levelNum = 0;
                        
                        // Lấy thẻ level riêng biệt
                        const levelSpan = nameDiv.querySelector('.group-level');
                        
                        if (levelSpan) {
                            const match = levelSpan.textContent.match(/\d+/);
                            if (match) levelNum = parseInt(match[0], 10);
                        }

                        // Lấy tên sạch:
                        // Thay vì cloneNode (nặng), ta lấy toàn bộ text rồi xóa phần text của level đi
                        let nameText = nameDiv.innerText;
                        if (levelSpan) {
                            nameText = nameText.replace(levelSpan.innerText, '').trim();
                        } else {
                            nameText = nameText.trim();
                        }

                        results.push({
                            id: id,
                            name: nameText,
                            level: levelNum
                        });
                    }
                });

                return results;

            } catch (error) {
                // Ghi log lỗi để dễ debug
                console.error("Lỗi tại getListTongMon:", error);
                // Ném lỗi tiếp ra ngoài để hàm gọi bên ngoài biết là có lỗi
                throw error;
            }
        }


        parseGroupRoleHtml(groupRoleHtml) {
            if (!groupRoleHtml || typeof groupRoleHtml !== 'string') {
                return { tongMonName: null, role: null };
            }

            try {
                const doc = new DOMParser().parseFromString(
                    `<div>${groupRoleHtml}</div>`,
                    'text/html'
                );
                const root = doc.body;

                /* =========
                * ROLE: tooltip cuối
                * ========= */
                const tooltips = Array.from(
                    root.querySelectorAll('span[data-tooltip]')
                )
                    .map(el => el.getAttribute('data-tooltip')?.trim())
                    .filter(Boolean);

                const role = tooltips.length
                    ? tooltips[tooltips.length - 1]
                    : null;

                /* =========
                * TÊN TÔNG
                * ========= */
                let tongMonName = null;

                const bangHoiEl = root.querySelector('span[class*="bang-hoi-mau"]');
                if (bangHoiEl) {
                    const t = (bangHoiEl.textContent || '').trim();
                    if (t) tongMonName = t;
                }

                if (!tongMonName) {
                    const wrapper = root.querySelector('.tong-cap-wrapper');
                    if (wrapper) {
                        const next = wrapper.nextElementSibling;
                        if (next && next.tagName === 'SPAN') {
                            const t = (next.textContent || '').trim();
                            if (t) tongMonName = t;
                        }
                    }
                }

                return { tongMonName, role };
            } catch {
                return { tongMonName: null, role: null };
            }
        }


        /**
         * Tìm kiếm kẻ địch theo ID và/hoặc theo Tông Môn (ID tông).
         * @param {string[]} enemyList - danh sách userId (string)
         * @param {string[]} tongMonList - danh sách groupId tông môn (string)
         * @param {function} onProgressCallback - callback để cập nhật tiến độ UI
         * @returns {Promise<Array>}
         */
        async searchEnemiesInMines(enemyList, tongMonList, onProgressCallback) {
            // 1. Chuẩn bị bộ lọc (Giữ nguyên)
            const enemySet = new Set((enemyList || []).map(x => String(x).trim()).filter(Boolean));
            const tongIdSet = new Set((tongMonList || []).map(x => String(x).trim()).filter(Boolean));

            if (enemySet.size === 0 && tongIdSet.size === 0) {
                showNotification('Vui lòng nhập ID kẻ địch hoặc chọn Tông Môn để tìm.', 'warn');
                return [];
            }

            // Map tên tông (Giữ nguyên)
            let tongNameSet = new Set();
            if (tongIdSet.size > 0) {
                try {
                    const allTong = await this.getListTongMon();
                    tongNameSet = new Set(
                        (allTong || []).filter(t => tongIdSet.has(String(t.id)))
                        .map(t => String(t.name || '').trim()).filter(Boolean)
                    );
                } catch (e) {}
            }

            // 2. Logic Lấy dữ liệu
            let minesData = [];
            let dataTimestamp = 0;
            let dataSource = '☁️ Server (Cache)'; 

            try {
                console.log('[Khoáng Mạch] Đang kiểm tra dữ liệu trên Server...');
                const serverData = await fetch(this.MINE_DATA_API_URL).then(r => r.json());
                const now = Date.now();
                
                if (serverData && serverData.timestamp && (now - serverData.timestamp < 5 * 60 * 1000)) {
                    minesData = serverData.mines || [];
                    dataTimestamp = serverData.timestamp;
                    showNotification(`Dữ liệu từ Server (${this.timeSince(dataTimestamp)})`, 'success');
                } else {
                    throw new Error('Dữ liệu cũ');
                }
            } catch (err) {
                console.log('[Khoáng Mạch] ' + err.message);
                dataSource = '🕵️ Quét trực tiếp';
                showNotification('Đang quét trực tiếp...', 'info');
                
                // Quét mới (truyền callback xuống để cập nhật UI)
                minesData = await this.scanAllMinesRawData(onProgressCallback);
                dataTimestamp = Date.now();

                // Upload lên server (Dùng hàm đã sửa header ở trên)
                this.uploadDataToServer(minesData);
            }

            // 🔥 BƯỚC QUAN TRỌNG: CHUẨN HÓA DỮ LIỆU (Normalize)
            // Phải đặt ở đây để chạy cho CẢ trường hợp lấy từ Server HOẶC quét mới
            if (minesData && minesData.length > 0) {
                minesData = minesData.map(m => ({
                    ...m,
                    users: (m.users || []).map(u => ({
                        // Map key ngắn (i, n, t, r) -> key dài (id, name...)
                        id: u.i || u.id,                     
                        name: u.n || u.name,
                        tongMonName: u.t || u.tongMonName,
                        role: u.r || u.role,
                        ...u 
                    }))
                }));
            }

            // 3. Lọc & Hiển thị (Giữ nguyên)
            const results = [];
            for (const mine of minesData) {
                if (!mine.users) continue;
                for (const u of mine.users) {
                    const uid = String(u.id ?? '').trim();
                    const uTong = String(u.tongMonName || '').trim();
                    if (enemySet.has(uid) || tongNameSet.has(uTong)) {
                        results.push({
                            ...u,
                            mineId: mine.id,
                            mineName: mine.name,
                            tongMonName: u.tongMonName,
                            role: u.role
                        });
                    }
                }
            }

            this.showEnemySearchResults(results, dataTimestamp, dataSource);
            const storageData = { results, timestamp: dataTimestamp, source: dataSource };
            sessionStorage.setItem('khoangmach_enemy_search_results', JSON.stringify(storageData));
            
            return results;
        }

        // Hàm phụ: Quét toàn bộ mỏ (Trả về dữ liệu thô để upload)
        async scanAllMinesRawData(onProgress) {
                console.log(`${this.logPrefix} 🕵️ Bắt đầu quét toàn bộ mỏ (Mode: Raw Data)...`);

                // Nếu có UI truyền xuống, báo cáo ngay
                if (onProgress) onProgress(0, 'Đang chuẩn bị dữ liệu...');

                // --- BƯỚC 1: LẤY DANH SÁCH MỎ & LỌC ---
                const allMines = await this.getAllMines();
                if (!allMines || !allMines.minesData) return [];

                // Chỉ lấy mỏ Gold/Silver
                const allowedTypes = new Set(['gold', 'silver']);
                const filteredMines = allMines.minesData.filter(m => allowedTypes.has(String(m.type)));
                
                if (filteredMines.length === 0) return [];

                // --- BƯỚC 2: CHUẨN BỊ TOKEN & NONCE (CHỈ LÀM 1 LẦN) ---
                
                // 2a. Lấy Security Nonce (cho action get_users_in_mine)
                let nonce = this.getUsersInMineNonce; // Kiểm tra cache xem có sẵn không
                if (!nonce) {
                    console.log(`${this.logPrefix} ♻️ Đang lấy Nonce mới...`);
                    // Gọi hàm getNonce (hoặc logic fetch regex tương đương)
                    nonce = await this.#getNonce(/action:\s*'get_users_in_mine',[\s\S]*?security:\s*'([a-f0-9]+)'/);
                    if (nonce) {
                        this.getUsersInMineNonce = nonce; // Lưu cache
                    }
                }

                // 2b. Lấy Security Token (Session)
                if (!this.securityToken) {
                    console.log(`${this.logPrefix} 🔑 Đang lấy Token mới...`);
                    this.securityToken = await getSecurityToken(this.khoangMachUrl);
                }

                // 2c. Kiểm tra lần cuối, nếu thiếu 1 trong 2 thì hủy quét
                if (!nonce || !this.securityToken) {
                    console.error(`${this.logPrefix} ❌ Không thể quét: Thiếu Token hoặc Nonce.`);
                    showNotification('Lỗi chuẩn bị dữ liệu quét mỏ.', 'error');
                    return [];
                }

                // --- BƯỚC 3: VÒNG LẶP QUÉT (DÙNG LẠI TOKEN & NONCE) ---
                const rawResult = [];
                const totalMines = filteredMines.length;
                console.log(`${this.logPrefix} 🚀 Bắt đầu quét ${totalMines} mỏ...`);

                for (let i = 0; i < totalMines; i++) {
                    const m = filteredMines[i];

                    // === 📞 GỌI VỀ UI ĐỂ CẬP NHẬT THANH TIẾN ĐỘ ===
                    if (onProgress) {
                        const percent = Math.floor(((i + 1) / totalMines) * 100);
                        onProgress(percent, `Đang quét...`);
                    }
                    // ===============================================
                    
                    // Payload dùng chung nonce và securityToken đã lấy ở Bước 2
                    const payload = new URLSearchParams({
                        action: 'get_users_in_mine',
                        mine_id: m.id,
                        security_token: this.securityToken, 
                        security: nonce
                    });

                    try {
                        const r = await fetch(this.ajaxUrl, { 
                            method: 'POST', 
                            headers: this.headers, 
                            body: payload, 
                            credentials: 'include' 
                        });
                        const d = await r.json();

                        if (d.success && d.data && d.data.users && d.data.users.length > 0) {
                            // MAP DATA SIÊU GỌN (để upload lên server)
                            const cleanUsers = d.data.users.map(u => {
                                const extra = this.parseGroupRoleHtml(u.group_role_html);
                                return {
                                    i: u.id,                                // i = id
                                    n: u.name,                              // n = name
                                    t: String(extra.tongMonName || '').trim(), // t = tongMon
                                    r: extra.role                           // r = role
                                };
                            });

                            rawResult.push({
                                id: m.id,
                                name: m.name,
                                users: cleanUsers
                            });
                        } 
                        else if (!d.success) {
                            // Nếu token bị lỗi giữa chừng (hết phiên), có thể break hoặc log
                            // console.warn(`Lỗi quét mỏ ${m.name}: ${d.data?.message}`);
                        }

                    } catch (e) {
                        console.error(`Lỗi mạng mỏ ${m.id}:`, e);
                    }

                    // Delay để tránh bị chặn (200ms)
                    await new Promise(resolve => setTimeout(resolve, 200));
                }

                if (onProgress) onProgress(100, 'Hoàn tất!');
                console.log(`${this.logPrefix} ✅ Hoàn tất quét. Tổng số mỏ có người: ${rawResult.length}`);
                return rawResult;
            }

        // Hàm phụ: Upload lên Server
        async  uploadDataToServer(minesData) {
            // Check sơ bộ: Nếu không có dữ liệu thì không gửi
            if (!minesData || minesData.length === 0) return;

            try {
                console.log(`[Khoáng Mạch] Đang đồng bộ ${minesData.length} mỏ lên server...`);
                
                // PAYLOAD Ở ĐÂY:
                const payload = JSON.stringify({ 
                    mines: minesData 
                });

                // (Tùy chọn) Log dung lượng để kiểm tra xem có quá 50KB không
                console.log(`[Khoáng Mạch] Payload size: ~${Math.round(payload.length/1024)} KB`);

                await fetch(this.MINE_DATA_API_URL, {
                    method: 'POST',
                    mode: 'no-cors', 
                    headers: { 'Content-Type': 'application/json' },
                    body: payload // <--- Gửi cục này
                });
                
                console.log('[Khoáng Mạch] Đã gửi yêu cầu đồng bộ.');
            } catch (e) {
                console.warn('[Khoáng Mạch] Lỗi upload:', e);
            }
        }

        // Hàm phụ: Format thời gian
        timeSince(date) {
            const seconds = Math.floor((new Date() - date) / 1000);
            let interval = seconds / 31536000;
            if (interval > 1) return Math.floor(interval) + " năm trước";
            interval = seconds / 2592000;
            if (interval > 1) return Math.floor(interval) + " tháng trước";
            interval = seconds / 86400;
            if (interval > 1) return Math.floor(interval) + " ngày trước";
            interval = seconds / 3600;
            if (interval > 1) return Math.floor(interval) + " giờ trước";
            interval = seconds / 60;
            if (interval > 1) return Math.floor(interval) + " phút trước";
            return Math.floor(seconds) + " giây trước";
        }

        /**
         * Hiển thị kết quả tìm kiếm với thông tin nguồn và thời gian
         * @param {Array} foundUsers Danh sách kẻ địch tìm thấy
         * @param {Number} timestamp Thời gian dữ liệu được tạo (Date.now())
         * @param {String} source Nguồn dữ liệu ('Server' hoặc 'Quét trực tiếp')
         */
        showEnemySearchResults(foundUsers, timestamp, source = 'N/A') {
            // 1. Kiểm tra dữ liệu đầu vào
            if (!Array.isArray(foundUsers) || foundUsers.length === 0) {
                showNotification('Không tìm thấy kẻ địch nào phù hợp trong các mỏ.', 'info');
                return;
            }

            const PANEL_ID = 'enemyDashboard';
            const RESTORE_ID = 'enemyDashboardRestore';

            // 2. Xóa panel cũ
            const oldPanel = document.getElementById(PANEL_ID);
            if (oldPanel) oldPanel.remove();
            const oldRestore = document.getElementById(RESTORE_ID);
            if (oldRestore) oldRestore.remove();

            // 3. Tiện ích
            const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const timeSinceStr = (ts) => {
                if (!ts) return 'Vừa xong';
                const seconds = Math.floor((Date.now() - ts) / 1000);
                if (seconds < 60) return `${seconds} giây trước`;
                const minutes = Math.floor(seconds / 60);
                if (minutes < 60) return `${minutes} phút trước`;
                return 'Khá lâu trước';
            };

            // 4. Gom nhóm
            const minesMap = foundUsers.reduce((acc, u) => {
                const mId = String(u.mineId || 'unknown');
                if (!acc[mId]) {
                    acc[mId] = {
                        id: mId,
                        name: u.mineName || 'Mỏ Lạ',
                        users: [],
                        tongMons: new Set()
                    };
                }
                acc[mId].users.push(u);
                if (u.tongMonName) acc[mId].tongMons.add(u.tongMonName);
                return acc;
            }, {});

            const sortedMines = Object.values(minesMap).sort((a, b) => b.users.length - a.users.length);

            // 5. Tạo Panel
            const panel = document.createElement('div');
            panel.id = PANEL_ID;
            panel.className = 'enemy-dashboard';
            panel.style.cssText = `
                position: fixed; right: 20px; bottom: 20px;
                width: 460px; max-width: 95vw;
                background: #1a1a1a; color: #e0e0e0;
                border: 1px solid #444; border-radius: 8px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.7);
                z-index: 999999; font-family: sans-serif;
                display: flex; flex-direction: column;
                overflow: hidden; font-size: 13px;
            `;

            const sourceColor = source.includes('Server') ? '#4caf50' : '#ff9800';

            // HTML Structure
            panel.innerHTML = `
                <div class="ed-header" style="padding: 10px 12px; background: #2d2d2d; border-bottom: 1px solid #3d3d3d;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <div style="font-weight: bold; font-size: 14px; color: #fff;">
                            🎯 Tìm thấy <span style="color: #ff5252;">${foundUsers.length}</span> mục tiêu
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <button id="btn-scan-all" style="background: #7b1fa2; color: #fff; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; font-weight: bold;">👁 Soi tu vi</button>
                            <button id="btn-attack-weak-global" style="background: #c62828; color: #fff; border: none; border-radius: 4px; padding: 4px 8px; font-size: 11px; cursor: pointer; font-weight: bold; display: none;">👊 Đấm Kẻ Yếu (0)</button>
                            
                            <button id="edMin" style="background:#3d3d3d; border:none; color:#fff; width:28px; height:28px; border-radius:4px; cursor:pointer;">—</button>
                            <button id="edClose" style="background:#d32f2f; border:none; color:#fff; width:28px; height:28px; border-radius:4px; cursor:pointer;">✕</button>
                        </div>
                    </div>
                    <div style="font-size: 11px; color: #aaa;">
                        Nguồn: <span style="font-weight:bold; color: ${sourceColor}">${source}</span> • ${timeSinceStr(timestamp)}
                    </div>
                </div>

                <div class="ed-body" style="padding: 10px; max-height: 60vh; overflow-y: auto; background: #1a1a1a;">
                    ${sortedMines.map(mine => {
                        const tongList = mine.tongMons.size > 0 ? Array.from(mine.tongMons).join(', ') : 'Vô phái';
                        return `
                        <div style="margin-bottom: 8px; border: 1px solid #333; border-radius: 6px; overflow: hidden;">
                            <div class="mine-header" data-target="m-${mine.id}" style="padding: 8px 10px; background: #252525; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                                <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
                                    <div style="flex: 1;">
                                        <div style="font-weight: bold; color: #ffd700;">⛏ ${esc(mine.name)}</div>
                                        <div style="font-size: 11px; color: #888;">Quân số: ${mine.users.length} | Phe: ${esc(tongList)}</div>
                                    </div>
                                    <button class="btn-scan-mine" data-target="m-${mine.id}" style="border: 1px solid #555; background: #333; color: #ccc; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer;">👁 Soi Mỏ</button>
                                    <button id="btn-weak-mine-${mine.id}" class="btn-attack-weak-mine" data-target="m-${mine.id}" style="background: #ef5350; color: #fff; border: none; border-radius: 3px; padding: 2px 6px; font-size: 10px; cursor: pointer; display: none; font-weight: bold;">👊 Đấm Kẻ Yếu</button>
                                </div>
                                <span class="arrow" style="font-size: 10px; color: #666; margin-left: 8px;">▼</span>
                            </div>
                            
                            <div id="m-${mine.id}" class="mine-content" style="display: none; padding: 5px 10px; background: #151515; border-top: 1px solid #333;">
                                ${mine.users.map(u => `
                                    <div style="padding: 6px 0; border-bottom: 1px dashed #333; display: flex; justify-content: space-between; align-items: center;">
                                        <div style="flex: 1;">
                                            <div style="color: #ff6b6b; font-weight: 500;">${esc(u.name)}</div>
                                            <div style="font-size: 11px; color: #777;">${esc(u.tongMonName || 'Vô phái')} - ${esc(u.role || 'Thành viên')}</div>
                                        </div>
                                        
                                        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                                            <div style="display: flex; gap: 5px;">
                                                <button class="btn-check-tuvi" data-uid="${u.id}" style="border:none; background: #039be5; color: white; border-radius: 3px; padding: 3px 8px; font-size: 11px; cursor: pointer; font-weight: bold;">👁</button>
                                                <button class="btn-attack" data-uid="${u.id}" data-mid="${mine.id}" style="border:none; background: #d32f2f; color: white; border-radius: 3px; padding: 3px 8px; font-size: 11px; cursor: pointer; font-weight: bold;">👊</button>
                                            </div>
                                            <div id="info-res-${u.id}" style="font-size: 10px; color: #b0bec5; min-height: 14px;"></div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            `;

            document.body.appendChild(panel);

            // Nút Restore
            const restoreBtn = document.createElement('button');
            restoreBtn.id = RESTORE_ID;
            restoreBtn.textContent = `🎯 (${foundUsers.length})`;
            restoreBtn.style.cssText = `display: none; position: fixed; bottom: 20px; right: 20px; padding: 8px 12px; border-radius: 20px; background: #2196f3; color: white; border: none; box-shadow: 0 5px 15px rgba(0,0,0,0.3); cursor: pointer; z-index: 999999; font-weight: bold;`;
            document.body.appendChild(restoreBtn);

            // Event Handlers cơ bản
            panel.querySelector('#edMin').onclick = () => { panel.style.display = 'none'; restoreBtn.style.display = 'block'; };
            panel.querySelector('#edClose').onclick = () => { panel.remove(); restoreBtn.remove(); };
            restoreBtn.onclick = () => { panel.style.display = 'flex'; restoreBtn.style.display = 'none'; };

            // Accordion Logic
            panel.querySelectorAll('.mine-header').forEach(header => {
                header.onclick = (e) => {
                    if (e.target.tagName === 'BUTTON') return; 
                    const targetId = header.getAttribute('data-target');
                    const content = document.getElementById(targetId);
                    const arrow = header.querySelector('.arrow');
                    if (content) {
                        const isOpen = content.style.display === 'block';
                        content.style.display = isOpen ? 'none' : 'block';
                        if (arrow) arrow.textContent = isOpen ? '▼' : '▲';
                    }
                };
            });
            
            // Mở mỏ đầu tiên
            const firstHeader = panel.querySelector('.mine-header');
            if (firstHeader) firstHeader.click();

            // Biến quản lý trạng thái nút Global
            const btnWeakGlobal = panel.querySelector('#btn-attack-weak-global');
            let weakCountGlobal = 0;

            // ============================================================
            // ⚔️ LOGIC: HELPER HÀM ĐẤM TỰ ĐỘNG (Dùng chung)
            // ============================================================
            const runBatchAttack = async (targets, statusBtn) => {
                if (targets.length === 0) {
                    showNotification('Không có mục tiêu nào!', 'warning');
                    return;
                }

                if (!confirm(`Tìm thấy ${targets.length} mục tiêu "Không tốn lượt".\nBắt đầu đấm? (Delay 6s/người)`)) {
                    return;
                }

                const originalText = statusBtn.textContent;
                statusBtn.disabled = true;

                for (let i = 0; i < targets.length; i++) {
                    const btn = targets[i];
                    
                    // Cập nhật trạng thái nút
                    statusBtn.textContent = `⏳ ${i + 1}/${targets.length} (Chờ 6s)`;

                    // Thực hiện đấm
                    btn.click();
                    
                    // Xóa class
                    btn.classList.remove('is-weak-target');
                    btn.style.border = 'none';

                    // Delay 6s (Trừ người cuối cùng)
                    if (i < targets.length - 1) {
                        await new Promise(r => setTimeout(r, 6000));
                    }
                }

                statusBtn.textContent = '✅ Xong';
                setTimeout(() => {
                    statusBtn.style.display = 'none'; // Ẩn nút sau khi xong
                    statusBtn.disabled = false;
                    statusBtn.textContent = originalText;
                }, 3000);
                showNotification('Đã xử lý xong danh sách!', 'success');
            };

            // ============================================================
            // ⚔️ LOGIC: CHECK TU VI
            // ============================================================
            panel.querySelectorAll('.btn-check-tuvi').forEach(btn => {
                btn.onclick = async (e) => {
                    e.stopPropagation();
                    const uid = btn.getAttribute('data-uid');
                    const resDiv = document.getElementById(`info-res-${uid}`);
                    const attackBtn = btn.parentElement.querySelector('.btn-attack');

                    btn.disabled = true;
                    btn.textContent = '...';
                    resDiv.textContent = 'Đang xem...';
                    
                    try {
                        const data = await hienTuviKM.enemyInfo(uid);

                        if (data) {
                            const tuViStr = new Intl.NumberFormat('vi-VN').format(data.tuVi || 0);
                            let rightSideHtml = '';

                            // ⚡ KÈO THƠM: KHÔNG TỐN LƯỢT
                            if (data.notCountAttack) {
                                rightSideHtml = `<span style="color: #ea80fc; font-weight: bold; text-shadow: 0 0 5px rgba(234,128,252,0.5);">⚡ Không tốn lượt</span>`;
                                
                                // Đánh dấu nút tấn công
                                if (attackBtn) {
                                    attackBtn.classList.add('is-weak-target');
                                    attackBtn.style.border = '1px solid #ea80fc';
                                    attackBtn.style.boxShadow = '0 0 5px #ea80fc';
                                    
                                    // 1. Cập nhật nút Global
                                    weakCountGlobal++;
                                    btnWeakGlobal.style.display = 'block';
                                    btnWeakGlobal.textContent = `👊 Đấm Kẻ Yếu (${weakCountGlobal})`;

                                    // 2. Cập nhật nút Local (Của mỏ)
                                    const mid = attackBtn.getAttribute('data-mid');
                                    const btnWeakMine = document.getElementById(`btn-weak-mine-${mid}`);
                                    if (btnWeakMine) {
                                        btnWeakMine.style.display = 'block';
                                        // Tăng đếm cho mỏ (lưu vào attribute data-count)
                                        let currentCount = parseInt(btnWeakMine.getAttribute('data-count') || 0) + 1;
                                        btnWeakMine.setAttribute('data-count', currentCount);
                                        btnWeakMine.textContent = `👊 Đấm Kẻ Yếu (${currentCount})`;
                                    }
                                }

                            } else {
                                // Kèo thường
                                const winRateRaw = data.winRate || '?';
                                const winRateDisplay = String(winRateRaw).includes('%') ? winRateRaw : `${winRateRaw}%`;
                                let rateNumber = parseInt(String(winRateRaw).replace('%', ''));
                                if (isNaN(rateNumber)) rateNumber = -1;

                                let rateColor = '#ffffff';
                                if (rateNumber === -1) rateColor = '#808080';
                                else if (rateNumber < 25) rateColor = '#ff5f5f';
                                else if (rateNumber > 75) rateColor = '#00ff00';

                                rightSideHtml = `<span style="color: ${rateColor}; font-weight: bold;">${winRateDisplay}</span>`;
                                
                                // Xóa dấu hiệu nếu user soi lại và thấy không còn ngon
                                if (attackBtn && attackBtn.classList.contains('is-weak-target')) {
                                    attackBtn.classList.remove('is-weak-target');
                                    attackBtn.style.border = 'none';
                                    attackBtn.style.boxShadow = 'none';
                                }
                            }

                            resDiv.innerHTML = `<span style="color: #4fc3f7;">${tuViStr}</span> | ${rightSideHtml}`;
                        } else {
                            resDiv.textContent = 'K.Rõ';
                            resDiv.style.color = '#ff5252';
                        }
                    } catch (err) {
                        console.error(err);
                        resDiv.textContent = 'Lỗi';
                    } finally {
                        btn.textContent = '👁'; 
                        btn.disabled = false;
                        btn.classList.add('checked-done');
                    }
                };
            });

            // ============================================================
            // ⚔️ LOGIC: ATTACK (Đơn lẻ)
            // ============================================================
            panel.querySelectorAll('.btn-attack').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const uid = btn.getAttribute('data-uid');
                    const mid = btn.getAttribute('data-mid');
                    btn.textContent = '⚔';
                    
                    if (typeof khoangmach !== 'undefined' && khoangmach.attackUser) {
                        khoangmach.attackUser(uid, mid);
                        setTimeout(() => {
                            btn.textContent = '✔';
                            btn.style.opacity = '0.5';
                        }, 500);
                    } else {
                        showNotification("Lỗi: Không tìm thấy hàm tấn công!", "error");
                    }
                };
            });

            // ============================================================
            // 🚀 LOGIC: SOI HÀNG LOẠT (Global & Local)
            // ============================================================
            const runBatchScan = async (buttons) => {
                if (!buttons || buttons.length === 0) return;
                
                // Khi soi mới, cần reset các biến đếm nếu muốn chính xác tuyệt đối, 
                // nhưng ở đây ta cứ cộng dồn cho đơn giản hoặc user tự tắt bật lại panel.
                showNotification(`Đang soi ${buttons.length} mục tiêu...`, 'info');

                for (const btn of buttons) {
                    if (!btn.disabled && !btn.classList.contains('checked-done')) {
                        btn.click(); 
                        await new Promise(r => setTimeout(r, 500)); // Delay soi 500ms
                    }
                }
                showNotification('Đã soi xong.', 'success');
            };

            panel.querySelector('#btn-scan-all').onclick = () => {
                // Reset đếm toàn cục khi soi lại từ đầu (tuỳ chọn)
                weakCountGlobal = 0;
                btnWeakGlobal.style.display = 'none';
                
                const allBtns = panel.querySelectorAll('.btn-check-tuvi');
                runBatchScan(allBtns);
            };

            panel.querySelectorAll('.btn-scan-mine').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const targetId = btn.getAttribute('data-target');
                    const mineContainer = document.getElementById(targetId);
                    
                    // Reset đếm cục bộ của mỏ này
                    const mid = targetId.replace('m-', '');
                    const btnWeakMine = document.getElementById(`btn-weak-mine-${mid}`);
                    if(btnWeakMine) {
                        btnWeakMine.style.display = 'none';
                        btnWeakMine.setAttribute('data-count', 0);
                    }

                    if(mineContainer && mineContainer.style.display === 'none') mineContainer.style.display = 'block';
                    if (mineContainer) {
                        runBatchScan(mineContainer.querySelectorAll('.btn-check-tuvi'));
                    }
                };
            });

            // ============================================================
            // 💀 LOGIC: ĐẤM KẺ YẾU (Xử lý sự kiện click)
            // ============================================================
            
            // 1. Sự kiện nút Tổng (Global)
            btnWeakGlobal.onclick = () => {
                const targets = panel.querySelectorAll('.btn-attack.is-weak-target');
                runBatchAttack(targets, btnWeakGlobal);
            };

            // 2. Sự kiện nút Từng Mỏ (Local)
            panel.querySelectorAll('.btn-attack-weak-mine').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation(); // Không đóng mở accordion
                    const targetId = btn.getAttribute('data-target'); // m-xxxx
                    const mineContainer = document.getElementById(targetId);
                    if (mineContainer) {
                        // Chỉ tìm kẻ yếu trong mỏ này
                        const targets = mineContainer.querySelectorAll('.btn-attack.is-weak-target');
                        runBatchAttack(targets, btn);
                    }
                };
            });
        }

    }

    //===================================
    // TIÊN DUYÊN
    //===================================
    class TienDuyen {
        nonce;
        constructor() {
            this.apiUrl = weburl + "wp-json/hh3d/v1/action";
        }
        async init() {
                this.nonce = await getNonce();
                this.securityToken = await getSecurityToken(weburl + 'tien-duyen?t');
            }
        async #post(action, body = {}) {
            const res = await fetch(this.apiUrl, {
                credentials: "include",
                method: "POST",
                headers: {
                    "Accept": "*/*",
                    "Content-Type": "application/json",
                    "X-WP-Nonce": this.nonce
                },
                body: JSON.stringify({ action, ...body })
            });
            return res.json();
        }

        // Lấy danh sách phòng cưới
        async getWeddingRooms() {
            this.securityToken = await getSecurityToken(weburl + 'tien-duyen?t');
            return await this.#post("show_all_wedding", {security_token: this.securityToken});
        }

        // Chúc phúc
        async addBlessing(weddingRoomId, message = "Chúc phúc trăm năm hạnh phúc 🎉") {
            return await this.#post("hh3d_add_blessing", {
                wedding_room_id: weddingRoomId,
                message
            });
        }

        // Nhận lì xì
        async receiveLiXi(weddingRoomId) {
            return await this.#post("hh3d_receive_li_xi", {
                wedding_room_id: weddingRoomId
            });
        }

        // Duyên: chúc phúc + nhận lì xì
        async doTienDuyen() {
            const lastCheck = taskTracker.getLastCheckTienDuyen(accountId);
            const now = new Date();
            if (now - lastCheck < 1800000) return;

            const list = await this.getWeddingRooms();
            if (!list?.data) {
                showNotification("Không có danh sách phòng cưới", 'warn');
                return;
            }

            for (const room of list.data) {
                taskTracker.setLastCheckTienDuyen(accountId, now)
                console.log(`👉 Kiểm tra phòng ${room.wedding_room_id}`);

                if (room.has_blessed === false) {
                    const bless = await this.addBlessing(room.wedding_room_id);
                    if (bless && bless.success === true) {
                        showNotification(`Bạn đã gửi lời chúc phúc cho cặp đôi <br><b>${room.user1_name} 💞 ${room.user2_name}</b>`, 'success')
                    }
                }

                if (room.has_li_xi === true) {
                    const liXi = await this.receiveLiXi(room.wedding_room_id);
                    if (liXi && liXi.success === true) {
                        showNotification(`Nhận lì xì phòng cưới ${room.wedding_room_id} được <b>${liXi.data.amount} ${liXi.data.name}</b>!`, 'success')
                    }
                }
                await new Promise(r => setTimeout(r, 500)); // chờ 1 giây tránh spam
            }
        }

        //Tặng hoa
        async tangHoa() {
            const friendIds = localStorage.getItem(`tienDuyenInputValue_${accountId}`) || '';
            const friendIdList = friendIds.split(';');
            let count = 0;
            friendLoop: for (const friendId of friendIdList) {
                if (friendId) {
                    const responseCheckGift = await fetch(weburl + '/wp-json/hh3d/v1/action', {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-Wp-Nonce': this.nonce
                        },
                        body: `action=check_daily_gift_limit&user_id=${accountId}&friend_id=${friendId}&cost_type=tien_ngoc`,
                    });
                    const dataCheckGift = await responseCheckGift.json();
                    if (dataCheckGift.success === false || dataCheckGift.tien_ngoc_available === false) {
                        showNotification(dataCheckGift.message, 'error');
                        continue;
                    }
                    if (dataCheckGift.message === "Đạo hữu đã gửi quà cho tối đa 5 người bạn khác nhau trong ngày hôm nay! Hãy thử lại vào ngày mai.") {
                        showNotification(dataCheckGift.message, 'error');
                        taskTracker.markTaskDone(accountId, 'tienduyen');
                        break friendLoop;
                    }
                    if (dataCheckGift.message === 'Đã đạt giới hạn tặng bằng Tiên Ngọc cho người này hôm nay.') {
                        count++;
                    }
                    // Tặng hoa 3 lần hoặc tối đa số hoa còn lại
                    for (let i = 0; i < dataCheckGift.remaining_free_gifts; i++) {
                        const response = await fetch(weburl + '/wp-json/hh3d/v1/action', {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'X-Wp-Nonce': this.nonce
                        },
                        body: `action=gift_to_friend&cost_type=tien_ngoc&friend_id=${friendId}&gift_type=hoa_hong`,
                        });
                        const data = await response.json();
                        if (data.success) {
                            showNotification(data.message, 'success');
                            if (i === dataCheckGift.remaining_free_gifts - 1) { count++; }
                        } else {
                            showNotification(data.message, 'error');
                            if (data.message === "Đạo hữu đã gửi quà cho tối đa 5 người bạn khác nhau trong ngày hôm nay! Hãy thử lại vào ngày mai.") {
                                taskTracker.markTaskDone(accountId, 'tienduyen');
                                break friendLoop;
                            }
                        }
                        await new Promise(r => setTimeout(r, 300));
                    }
                    showNotification(`Đã tặng hoa cho bạn bè: ${count}`, 'info');
                    if (count >= 5) {
                        taskTracker.markTaskDone(accountId, 'tienduyen');
                        break friendLoop;
                    }; // Chỉ tặng hoa cho tối đa 5 bạn bè
                    await new Promise(r => setTimeout(r, 300));
                }
            }
            this.uocNguyen();
        }

        //Danh sách bạn bè
        async danhsachBanBe() {
            const response = await fetch(weburl + '/wp-json/hh3d/v1/action', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Wp-Nonce': this.nonce
                },
                body: `action=get_friends_td`,
            });
            const data = await response.json();
            const now = new Date(); // Thời gian hiện tại
            const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000; // 3 ngày đổi ra mili-giây

            return data
                .filter(user => {
                    // Chuyển string time thành đối tượng Date
                    // replace(' ', 'T') để đảm bảo chuẩn ISO cho mọi trình duyệt
                    const userTime = new Date(user.time.replace(' ', 'T'));

                    // Tính khoảng cách thời gian
                    const diff = now - userTime;

                    // Giữ lại nếu khoảng cách > 3 ngày
                    return diff > THREE_DAYS_MS;
                })
                .map(user => ({
                    id: user.user_id,
                    name: user.display_name,
                    thanMat: user.than_mat
                }));
        }

        //Ước nguyện
        async uocNguyen() {
            const isUocNguyenDone = taskTracker.getTaskStatus(accountId, 'tienduyen').uoc_nguyen_done === true;
            if (isUocNguyenDone) return;
            const response = await fetch(weburl + '/wp-json/hh3d/v1/action', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Wp-Nonce': this.nonce
                },
                body: `action=make_wish_tree`,
            });
            const data = await response.json();
            if (data.success) {
                showNotification(data.message, 'success');
                taskTracker.updateTask(accountId, 'tienduyen', 'uoc_nguyen_done', true);
            } else if (data.status === "already_wished") {
                taskTracker.updateTask(accountId, 'tienduyen', 'uoc_nguyen_done', true);
                showNotification("Hôm nay đã ước nguyện rồi!", 'warn');
            } else if (data.message === "Chưa có đạo lữ để ước nguyện Tiên Duyên Thụ") {
                showNotification("Chưa có đạo lữ để ước nguyện Tiên Duyên Thụ", 'warn');
                taskTracker.updateTask(accountId, 'tienduyen', 'uoc_nguyen_done', true);
            } else {
                showNotification(data.message || "Lỗi không xác định khi ước nguyện", 'error');
            }
        }
    }

    //==================================
    // RƯƠNG HOẠT ĐỘNG NGÀY
    //==================================
    class HoatDongNgay {
        constructor() {
            this.ajaxUrl = weburl + "/wp-admin/admin-ajax.php";
        }

        // Phương thức để gửi yêu cầu lấy rương (Daily Chest)
        async getDailyChest(stage) {
            if (stage !== "stage1" && stage !== "stage2") {
                console.error("Lỗi: Stage phải là 'stage1' hoặc 'stage2'.");
                return false;
            }
            const securityToken = await getSecurityToken(weburl + 'bang-hoat-dong-ngay?t');
            const bodyData = `action=daily_activity_reward&stage=${stage}&security_token=${encodeURIComponent(securityToken)}`;

            try {
                const response = await fetch(this.ajaxUrl, {
                    credentials: "include",
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0",
                        "Accept": "*/*",
                        "Accept-Language": "vi,en-US;q=0.5",
                        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                        "X-Requested-With": "XMLHttpRequest",
                    },
                    body: bodyData,
                    method: "POST",
                    mode: "cors"
                });

                const data = await response.json();
                if (data.success || data.data.message === "Đạo hữu đã nhận phần thưởng này rồi.") {
                    return true
                } else {
                    showNotification(`❌ Lỗi nhận rương hàng ngày 1`, 'error');
                    return false;
                }
            } catch (error) {
                console.error(`Lỗi khi lấy rương ${stage}:`, error);
                return false;
            }
        }

        // Phương thức để gửi yêu cầu spin vòng quay
        async spinLottery() {
            const nonce = await getNonce();
            if (!nonce) {
                showNotification('❌ Lỗi: Không thể lấy nonce cho vòng quay phúc vận', 'error');
                return false;
            }
            const spinURL = weburl + "wp-json/lottery/v1/spin";
            const securityToken = await getSecurityToken(weburl + 'vong-quay-phuc-van?t');
            let remainingSpins = 4;
            do {
                try {
                    const response = await fetch(spinURL, {
                        credentials: "include",
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0",
                            "Accept": "*/*",
                            "Accept-Language": "vi,en-US;q=0.5",
                            "X-Security-Token": securityToken,
                            "X-WP-Nonce": nonce,
                            "Content-Type": "application/json",
                        },
                        method: "POST",
                        mode: "cors"
                    });

                    const data = await response.json();
                    if (data.success) {
                        showNotification(`🎉 Vòng quay phúc vận: ${data.message}`, 'success');
                        remainingSpins = data.user_info.remaining_spins
                        if (remainingSpins === 0) {
                            return true;
                        }
                    } else if (data.message === "Đạo hữu đã hết lượt quay hôm nay.") {
                        return true;
                    } else {
                        showNotification(`❌ Lỗi khi quay vòng quay phúc vận: ${data.message}`, 'error');
                        return false;
                    }
                } catch (error) {
                    console.error("Lỗi khi spin:", error);
                    return false;
                }
                await new Promise(r => setTimeout(r, 1000)); // chờ 1.5 giây tránh spam
            } while (remainingSpins > 0);
        }

        async doHoatDongNgay() {
            const isTaskDone = taskTracker.isTaskDone(accountId, 'hoatdongngay');
            if (taskTracker.isTaskDone(accountId, 'hoatdongngay')) return;

            console.log("Bắt đầu nhận rương hoạt động ngày...");
            const chest1 = await this.getDailyChest("stage1");
            const chest2 = await this.getDailyChest("stage2");
            const spin = await this.spinLottery();
            if (chest1 && chest2 && spin) {
                taskTracker.markTaskDone(accountId, 'hoatdongngay');
                showNotification("✅ Hoàn thành hoạt động ngày và vòng quay phúc vận!", 'success');
            }
        }
    }

    // ===============================================
    // EVENT ĐUA TOP
    // ===============================================
    // --- CẤU HÌNH ---
    const SECRET_API_URL = 'https://script.google.com/macros/s/AKfycbwOuq62VOwVB0RGraqKUvicsXZjsqsziFDwts0jktwQb2vCPSoJ3t98xGr26yNgfIvZ/exec'; 

    async function doDuaTopTongMon() {
        const duaTopUrl = weburl + 'wp-json/hh3d/v1/action';
        const nonce = await getNonce();
        if (!nonce) return console.error('Lỗi nonce.');

        // 1. Load Data
        if (!vandap.questionDataCache) {
            await vandap.loadAnswersFromGitHub();
        }
        const securityToken = await getSecurityToken(weburl + 'dua-top-hh3d?t');

        try {
            // 2. Lấy câu hỏi
            const rGet = await fetch(duaTopUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce, 'X-DuaTop-Token': securityToken },
                body: JSON.stringify({ action: 'hh3d_get_question', dua_top_token: securityToken }),
                credentials: 'include'
            });
            const dGet = await rGet.json();

            if (!dGet || dGet.error || !dGet.id) {
                showNotification(dGet.message, 'warn');
                if (dGet.message && dGet.message.includes('Chưa đến thời gian kế tiếp')) {
                    const nextTimeMatch = dGet.message.match(/(\d{2}) giờ (\d{2}) phút (\d{2}) giây/);
                    if (nextTimeMatch) {
                        const hours = parseInt(nextTimeMatch[1], 10);
                        const minutes = parseInt(nextTimeMatch[2], 10);
                        const seconds = parseInt(nextTimeMatch[3], 10);
                        const nextTime = Date.now() + ((hours * 3600) + (minutes * 60) + seconds) * 1000;
                        taskTracker.adjustTaskTime(accountId, 'event', nextTime);
                    }
                }
                return;
            }

            console.log(`[Đua Top] ❓ ${dGet.question}`);

            // --- HÀM GỌI SERVER ---
            const callSecretServer = (action, question, answer = null) => {
                console.log(`[Sync] ☁️ Đang gửi lệnh ${action}...`);
                fetch(SECRET_API_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: action,
                        question: question,
                        answer: answer
                    })
                }).then(() => console.log(`[Sync] ✅ Lệnh ${action} đã gửi đi!`))
                .catch(e => console.error(`[Sync] ❌ Lỗi kết nối server:`, e));
            };

            // --- HÀM SUBMIT ---
            const submitAnswer = async (index, isManual = false) => {
                const rSub = await fetch(duaTopUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce, 'X-DuaTop-Token': securityToken },
                    body: JSON.stringify({
                        action: "hh3d_submit_answer",
                        question_id: dGet.id,
                        selected_answer: index,
                        dua_top_token: securityToken
                    }),
                    credentials: 'include'
                });
                const dSub = await rSub.json();

                if (dSub.correct) {
                    showNotification(`[Đua Top] Hoàn thành, được ${dSub.points} tu vi`, 'success');
                    taskTracker.adjustTaskTime(accountId, 'event', Date.now() + 6.5 * 60 * 60 * 1000 + 30 * 1000);
                    if (Swal.isVisible()) Swal.close();

                    if (isManual) {
                        const ansText = dGet.options[index];
                        callSecretServer('save', dGet.question, ansText);
                        if (vandap.questionDataCache) vandap.questionDataCache.questions[dGet.question] = ansText;
                    }
                } else {
                    showNotification(`[Đua Top] Sai rồi! Câu hỏi: ${dGet.question}. Đang tiến hành sửa dữ liệu gốc`, 'error');
                    taskTracker.adjustTaskTime(accountId, 'event', Date.now() + 5 * 60 * 1000 + 15 * 1000);

                    if (vandap && vandap.questionDataCache && vandap.questionDataCache.questions) {
                        const normalize = (str) => str ? str.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?\s]/g, '') : '';
                        const currentQNorm = normalize(dGet.question);
                        const keyToDelete = Object.keys(vandap.questionDataCache.questions).find(k => normalize(k) === currentQNorm);

                        if (keyToDelete) {
                            console.warn(`[Auto] 🗑️ Phát hiện dữ liệu sai, đang xóa: "${keyToDelete}"`);
                            delete vandap.questionDataCache.questions[keyToDelete];
                            callSecretServer('delete', keyToDelete);
                        }
                    }
                }
            };

            // 3. Logic tìm kiếm
            // Normalize 1: Xóa hết ký tự đặc biệt VÀ khoảng trắng (dùng để tìm key câu hỏi)
            const normalize = (str) => str ? str.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?\s]/g, '') : '';
            
            // Tokenize: Giữ lại khoảng trắng để tách từ (dùng để so sánh điểm trùng lặp đáp án)
            const tokenize = (str) => str ? str.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, ' ').trim().split(/\s+/).filter(x => x) : [];

            const svQuesNorm = normalize(dGet.question);
            let foundAnswerText = null;

            if (vandap.questionDataCache && vandap.questionDataCache.questions) {
                for (const key in vandap.questionDataCache.questions) {
                    if (normalize(key) === svQuesNorm) {
                        foundAnswerText = vandap.questionDataCache.questions[key];
                        break;
                    }
                }
            }

            // 4. Quyết định
            if (foundAnswerText) {
                console.log(`[Đua Top] 💡 Dữ liệu gốc: "${foundAnswerText}"`);
                
                // Bước 1: Thử tìm chính xác
                let idx = dGet.options.findIndex(opt => normalize(opt) === normalize(foundAnswerText));

                // Bước 2: Tìm theo điểm trùng từ
                if (idx === -1) {
                    console.warn('[Đua Top] ⚠️ Không khớp chính xác, tính điểm trùng từ...');
                    let maxScore = -1;
                    let bestIdx = -1;
                    const targetTokens = tokenize(foundAnswerText);

                    dGet.options.forEach((opt, i) => {
                        const optTokens = tokenize(opt);
                        const intersection = optTokens.filter(token => targetTokens.includes(token));
                        const score = intersection.length; 
                        if (score > maxScore) {
                            maxScore = score;
                            bestIdx = i;
                        }
                    });

                    if (bestIdx > -1 && maxScore > 0) {
                        idx = bestIdx;
                    }
                }

                if (idx > -1) {
                    await submitAnswer(idx, false);
                } else {
                    console.warn('[Đua Top] 🛑 Có đáp án mẫu nhưng không khớp option.');
                    
                    // --- SỬA LỖI HIỂN THỊ TẠI ĐÂY ---
                    // Đưa text gợi ý vào thành HTML
                    const buttonsHtml = dGet.options.map((opt, i) =>
                        `<button id="btn-opt-${i}" class="swal2-confirm swal2-styled" 
                        style="display:block; width:100%; margin: 5px 0; background-color: #3085d6;">${opt}</button>`
                    ).join('');
                    
                    // Tạo đoạn HTML chứa cả Gợi ý và Nút
                    const contentHtml = `
                        <div style="margin-bottom: 15px; color: #d33; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                            Gợi ý: ${foundAnswerText}
                        </div>
                        <div>${buttonsHtml}</div>
                    `;

                    await Swal.fire({
                        title: dGet.question,
                        html: contentHtml, // Dùng duy nhất html
                        showConfirmButton: false, showCancelButton: true, cancelButtonText: 'Bỏ qua',
                        didOpen: () => {
                            dGet.options.forEach((_, i) => {
                                const btn = document.getElementById(`btn-opt-${i}`);
                                if (btn) btn.onclick = () => submitAnswer(i, true);
                            });
                        }
                    });
                }

            } else {
                console.warn('[Đua Top] 🛑 Hỏi người dùng (Chưa có dữ liệu)...');
                
                // --- SỬA LỖI HIỂN THỊ TẠI ĐÂY (TRƯỜNG HỢP KHÔNG CÓ DATA) ---
                const buttonsHtml = dGet.options.map((opt, idx) =>
                    `<button id="btn-opt-${idx}" class="swal2-confirm swal2-styled" 
                    style="display:block; width:100%; margin: 5px 0; background-color: #3085d6;">${opt}</button>`
                ).join('');

                await Swal.fire({
                    title: dGet.question,
                    // Không dùng 'text' nữa vì tiêu đề đã có câu hỏi rồi, hoặc nếu muốn hiện lại câu hỏi thì đưa vào html
                    html: buttonsHtml, 
                    showConfirmButton: false, showCancelButton: true, cancelButtonText: 'Bỏ qua',
                    didOpen: () => {
                        dGet.options.forEach((_, idx) => {
                            const btn = document.getElementById(`btn-opt-${idx}`);
                            if (btn) btn.onclick = () => submitAnswer(idx, true);
                        });
                    }
                });
            }
        } catch (e) { console.error('[Đua Top] Lỗi:', e); }
    }


    // ===============================================
    // HÀM HIỂN THỊ THÔNG BÁO
    //
    /**
     * HÀM HIỂN THỊ THÔNG BÁO
     * @param {*} message: nội dung thông báo (hỗ trợ HTML)
     * @param {*} type: success, warn, error, info
     * @param {*} duration: thời gian hiển thị (ms)
     */
    function showNotification(message, type = 'success', duration = 3000) {

        // --- Bắt đầu phần chèn CSS tự động ---
        if (!isCssInjected) {
            const style = document.createElement('style');
            style.type = 'text/css';
            style.innerHTML = `
                #hh3d-notification-container {
                  position: fixed;
                  top: 20px;
                  right: 20px;
                  display: flex;
                  flex-direction: column;
                  align-items: flex-end;
                  gap: 10px;
                  z-index: 1000000;
                  pointer-events: none;
                }

                .hh3d-notification-item {
                  padding: 10px 20px;
                  border-radius: 5px;
                  color: white;
                  min-width: 250px;
                  max-width: 350px;
                  pointer-events: auto;
                  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                  transition: all 0.5s ease-in-out;
                  opacity: 0;
                  transform: translateX(100%);
                  background-color: white;
                }

                .hh3d-notification-item.success {
                  background-color: #4CAF50;
                }
                .hh3d-notification-item.warn {
                  background-color: #ff9800;
                }
                .hh3d-notification-item.error {
                  background-color: #f44336;
                }
                .hh3d-notification-item.info {
                  background-color: #0066ffff;
                }
            `;
            document.head.appendChild(style);
            isCssInjected = true;
        }
        // --- Kết thúc phần chèn CSS tự động ---

        // Log console
        const logPrefix = '[HH3D Notification]';
        if (type === 'success') {
            console.log(`${logPrefix} ✅ SUCCESS: ${message}`);
        } else if (type === 'warn') {
            console.warn(`${logPrefix} ⚠️ WARN: ${message}`);
        } else if (type === 'info') {
            console.info(`${logPrefix} ℹ️ INFO: ${message}`);
        } else {
            console.error(`${logPrefix} ❌ ERROR: ${message}`);
        }

        // Tạo container nếu chưa tồn tại
        let container = document.getElementById('hh3d-notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'hh3d-notification-container';
            document.body.appendChild(container);
        }

        // Tạo item thông báo
        const notification = document.createElement('div');
        notification.className = `hh3d-notification-item ${type}`;
        if (/<[a-z][\s\S]*>/i.test(message)) {
            notification.innerHTML = message; // có HTML
        } else {
            notification.innerText = message; // chỉ text
        }

        container.appendChild(notification);

        // Hiển thị thông báo với hiệu ứng trượt vào
        requestAnimationFrame(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        });

        // Tự động ẩn và xóa thông báo
        let timeoutId = setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 500);
        }, duration);

        // Cho phép người dùng tương tác
        notification.addEventListener('mouseenter', () => {
            clearTimeout(timeoutId);
        });

        notification.addEventListener('mouseleave', () => {
            timeoutId = setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => notification.remove(), 500);
            }, 500);
        });

        notification.addEventListener('click', () => {
            clearTimeout(timeoutId);
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 500);
        });
    };

    // ===============================================
    // Class quản lý các quy tắc CSS
    // ===============================================
    class UIMenuStyles {
    addStyles() {
        const style = document.createElement('style');
        style.innerHTML = `
            /* Kiểu chung cho toàn bộ menu */
            .custom-script-menu {
                display: flex !important;
                flex-direction: column !important;
                position: absolute;
                background-color: #242323ff;
                min-width: 300px !important;
                z-index: 1001;
                border-radius: 5px;
                top: calc(100% + 6px);
                right: 0;
                padding: 8px;
                gap: 6px;
            }

            /* Kiểu chung cho các nhóm nút */
            .custom-script-menu-group {
                display: flex;
                flex-direction: row;
                gap: 6px;
                flex-wrap: wrap;
                justify-content: flex-start;
            }

            /* Kiểu chung cho tất cả các nút (a, button) */
            .custom-script-menu-button,
            .custom-script-menu-link {
                color: black;
                padding: 8px 10px !important;
                font-size: 13px !important;
                text-decoration: none;
                border-radius: 5px;
                background-color: #f1f1f1;
                flex-grow: 1;
                display: flex;
                justify-content: center;
                align-items: center;
                border: none;
                cursor: pointer;
                transition: all 0.2s ease-in-out;
            }
            .custom-script-menu.hidden {
                visibility: hidden;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.2s ease;
            }

            .custom-script-menu-button:hover,
            .custom-script-menu-link:hover {
                box-shadow: 0 0 15px rgba(0, 0, 0, 0.7);
                transform: scale(1.03);
            }

            /* Nút auto-btn */
            .custom-script-auto-btn {
                background-color: #3498db;
                color: white;
                font-weight: bold;
            }
            .custom-script-auto-btn:hover {
                background-color: #2980b9;
            }
            .custom-script-auto-btn:disabled {
                background-color: #7f8c8d;
                cursor: not-allowed;
                box-shadow: none;
            }

            /* Nhóm Dice Roll */
            .custom-script-dice-roll-group {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-grow: 1;
            }
            .custom-script-dice-roll-select {
                padding: 8px 10px;
                font-size: 13px;
                border-radius: 5px;
                border: 1px solid #ccc;
                background-color: #fff;
                color: black;
                cursor: pointer;
                flex-grow: 1;
            }
            .custom-script-dice-roll-btn {
                background-color: #e74c3c;
                color: white;
                font-weight: bold;
                padding: 8px 10px;
            }
            .custom-script-dice-roll-btn:hover {
                background-color: #c0392b;
            }
            .custom-script-dice-roll-btn:disabled {
                background-color: #7f8c8d;
                cursor: not-allowed;
                box-shadow: none;
            }
            .custom-script-menu-group-dice-roll {
                display: flex;
                flex-direction: row;
                gap: 6px;
                flex-wrap: wrap;
                justify-content: flex-start;
                align-items: center;
            }

            /* Nhóm Hoang Vực */
            .custom-script-hoang-vuc-group {
                display: flex;
                flex-direction: row;
                gap: 6px;
            }
            .custom-script-hoang-vuc-btn,
            .custom-script-hoang-vuc-settings-btn {
                border-radius: 5px;
                border: none;
                font-weight: bold;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .custom-script-hoang-vuc-btn {
                background-color: #3498db;
                color: white;
            }
            .custom-script-hoang-vuc-btn:hover {
                background-color: #3498db;
            }
            .custom-script-hoang-vuc-btn:disabled {
                background-color: #7f8c8d;
                cursor: not-allowed;
                box-shadow: none;
            }
            .custom-script-hoang-vuc-settings-btn {
                width: 30px;
                height: 30px;
                background-color: #555;
                color: white;
                border-radius: 15px;
                margin-top: 5px;

            }
            .custom-script-hoang-vuc-settings-btn:hover {
                background-color: #1f6da1ff;
            }

            /* Khoáng Mạch */
            .custom-script-khoang-mach-container {
                display: flex;
                flex-direction: column;
                gap: 6px;
                width: 100%;
            }

            .custom-script-khoang-mach-button-row {
                display: flex;
                flex-direction: row;
                gap: 6px;
                width: 100%;
            }

            .custom-script-khoang-mach-button {
                padding: 8px 10px !important;
                font-size: 13px !important;
                text-decoration: none;
                border-radius: 5px;
                background-color: #3498db;
                color: white;
                font-weight: bold;
                flex-grow: 1;
                display: flex;
                justify-content: center;
                align-items: center;
                border: none;
                cursor: pointer;
                transition: all 0.2s ease-in-out;
            }
            .custom-script-khoang-mach-button:disabled {
                background-color: #7f8c8d;
                cursor: not-allowed;
                box-shadow: none;
            }
            .custom-script-settings-panel {
                background-color: #333;
                border: 1px solid #444;
                border-radius: 5px;
                padding: 8px;
                display: flex;
                flex-direction: column;
                gap: 6px;
            }

            .custom-script-khoang-mach-config-group {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }

            .custom-script-khoang-mach-config-group label {
                font-size: 13px;
                color: #ccc;
                font-weight: bold;
            }

            .custom-script-khoang-mach-config-group select {
                padding: 8px;
            }

            .custom-script-khoang-mach-config-group.checkbox-group {
                flex-direction: row;
                align-items: center;
                gap: 6px;
            }

            .custom-script-khoang-mach-config-group.checkbox-group input[type="checkbox"] {
                width: 16px;
                height: 16px;
            }
            .custom-script-khoang-mach-config-group.number-input-group {
                flex-direction: row;
                align-items: center;
                gap: 6px;
            }

            /* Hiệu ứng cho nút tìm kiếm */
            @keyframes searchIconToggle {
                0%, 49.9% {
                    content: '🔍';
                }
                50%, 100% {
                    content: '🔎';
                }
            }

            .custom-script-hoang-vuc-settings-btn.searching {
                animation: searchIconToggle 1s infinite;
            }

            .custom-script-status-icon {
                width: 10px;
                height: 10px;
                margin-top: 0px;
                margin-right: 0px;
            }

            .custom-script-item-wrapper {
                position: relative; /* Quan trọng: Đặt vị trí tương đối để định vị icon */
            }

            /* Biểu tượng trạng thái Autorun */
            .custom-script-status-icon {
                position: absolute;
                top: -5px;
                right: -5px;
                width: 10px;
                height: 10px;
                background-color: transparent;
                border-radius: 50%;
                border: none;
                z-index: 10;
            }

            /* Khi autorun đang chạy */
            .custom-script-status-icon.running {
                background-color: #e74c3c; /* Màu đỏ */
                animation: pulse 1.5s infinite; /* Hiệu ứng nhấp nháy */
            }

            /* Hiệu ứng nhấp nháy */
            @keyframes pulse {
                0% {
                    transform: scale(1);
                    opacity: 1;
                }
                50% {
                    transform: scale(1.5);
                    opacity: 0.5;
                }
                100% {
                    transform: scale(1);
                    opacity: 1;
                }
            }

            /* CSS cho container chứa nhiều thông báo */
            .custom-script-status-bar {
                position: relative;
                bottom: 0px;           /* ✅ bám đáy parent thay vì top */
                left: 50%;
                transform: translateX(-50%);
                width: 100%;
                max-width: 250px;
                padding: 5px;
                display: flex;
                flex-direction: column; /* thông báo mới nằm trên */
                gap: 5px;
                z-index: 1000;
            }

            /* CSS cho từng thông báo riêng lẻ */
            .custom-script-message {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 500;
                color: #fff;
                white-space: nowrap;
                text-align: center;
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                opacity: 0;
                animation: fadeIn 0.3s forwards;
                transition: opacity 0.3s ease-in-out;
            }

            /* Các loại thông báo */
            .custom-script-message.info {
                background-color: #3498db;
            }

            .custom-script-message.success {
                background-color: #2ecc71;
            }


            @keyframes fadeIn {
                from {
                    opacity: 0;
                    transform: scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
}
            `;

        document.head.appendChild(style);
    }
    }

    // ===============================================
    // Class quản lý việc tạo các menu con
    // ===============================================
    class UIMenuCreator {
        constructor(parentGroup, accountId) {
            this.parentGroup = parentGroup;
            this.accountId = accountId;
            this.buttonMap = new Map();
            this.autorunIsRunning = false;
        }
        setAutorunIsRunning() {
            this.autorunIsRunning = true;
        }

        // Phương thức chung để cập nhật trạng thái của nút
        async updateButtonState(taskName) {
            const button = this.buttonMap.get(taskName);
            if (!button) return;
            const statusIcon = document.querySelector('.custom-script-status-icon');

            // Xử lý logic cập nhật trạng thái dựa trên tên nhiệm vụ (taskName)
            switch (taskName) {
                case 'autorun':
                    if (this.autorunIsRunning) {
                        button.textContent = 'Đang chạy autorun...';
                        if (statusIcon) {
                            statusIcon.classList.add('running');
                        }
                    } else {
                        button.textContent = 'Autorun';
                        if (statusIcon) {
                            statusIcon.classList.remove('running');
                        }
                    }
                    break;
                case 'diemdanh':
                case 'thiluyen':
                case 'phucloi':
                case 'hoangvuc':
                case 'luanvo':
                case 'tienduyen':
                case 'khoangmach':
                    if (taskTracker.isTaskDone(this.accountId, taskName)) {
                        button.disabled = true;
                        button.textContent = `${button.textContent.replace(' ✅', '')} ✅`;
                    } else {
                        button.disabled = false;
                        button.textContent = button.textContent.replace(' ✅', '');
                    }
                    break;
                case 'dothach':
                    const currentHour = parseInt(new Date().toLocaleString('en-US', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                        hour: 'numeric',
                        hour12: false // Định dạng 24 giờ
                    }), 10);

                    const isBetTime = (currentHour >= 6 && currentHour < 13) || (currentHour >= 16 && currentHour < 21);
                    const status = taskTracker.getTaskStatus(this.accountId, 'dothach');
                    if ((status.betplaced && isBetTime) || (status.reward_claimed && !isBetTime)) {
                        button.disabled = true;
                    } else {
                        button.disabled = false;
                    }
                    break;
                case 'bicanh':
                    const isDailyLimit = await bicanh.isDailyLimit();
                    if (isDailyLimit) {
                        button.disabled = true;
                        button.textContent = 'Bí Cảnh ✅';
                    } else {
                        button.disabled = false;
                        button.textContent = 'Bí Cảnh';
                    }
                    break;
            }
        }

        // Phương thức tạo menu "Đổ Thạch"
        async createDiceRollMenu(parentGroup) {
            parentGroup.classList.add('custom-script-dice-roll-group');

            const select = document.createElement('select');
            select.id = 'dice-roll-select';
            select.classList.add('custom-script-dice-roll-select');

            const optionTai = document.createElement('option');
            optionTai.value = 'tai';
            optionTai.textContent = 'Tài';
            select.appendChild(optionTai);

            const optionXiu = document.createElement('option');
            optionXiu.value = 'xiu';
            optionXiu.textContent = 'Xỉu';
            select.appendChild(optionXiu);

            const savedChoice = localStorage.getItem('dice-roll-choice') ?? 'tai';
            select.value = savedChoice;

            // 🔹 Lưu lại mỗi khi thay đổi
            select.addEventListener('change', () => {
                localStorage.setItem('dice-roll-choice', select.value);
            });

            const rollButton = document.createElement('button');
            rollButton.textContent = 'Đổ Thạch';
            rollButton.classList.add('custom-script-menu-button', 'custom-script-dice-roll-btn');
            this.buttonMap.set('dothach', rollButton);

            rollButton.addEventListener('click', async () => {
                const selectedChoice = select.value;
                rollButton.textContent = 'Đang xử lý...';
                await dothach.run(selectedChoice);
                rollButton.textContent = 'Đổ Thạch';
                this.updateButtonState('dothach');
            });

            this.updateButtonState('dothach');
            parentGroup.appendChild(select);
            parentGroup.appendChild(rollButton);

        }

        // Phương thức tạo menu "Hoang Vực"
        createHoangVucMenu(parentGroup) {
            const hoangVucButton = document.createElement('button');
            hoangVucButton.textContent = 'Hoang Vực';
            hoangVucButton.classList.add('custom-script-hoang-vuc-btn');
            this.buttonMap.set('hoangvuc', hoangVucButton)

            const settingsButton = document.createElement('button');
            settingsButton.classList.add('custom-script-hoang-vuc-settings-btn');

            const updateSettingsIcon = () => {
                const maximizeDamage = localStorage.getItem('hoangvucMaximizeDamage') === 'true';
                if (maximizeDamage) {
                    settingsButton.textContent = '🔼';
                    settingsButton.title = 'Tối đa hoá sát thương: Bật';
                } else {
                    settingsButton.textContent = '🔷';
                    settingsButton.title = 'Tối đa hoá sát thương: Tắt';
                }
            };

            hoangVucButton.addEventListener('click', async () => {
                hoangVucButton.disabled = true;
                hoangVucButton.textContent = 'Đang xử lý...';
                try {
                    await hoangvuc.doHoangVuc();
                }
                finally {
                    hoangVucButton.textContent = 'Hoang Vực';
                    this.updateButtonState('hoangvuc');
                }
            });

            settingsButton.addEventListener('click', () => {
                let maximizeDamage = localStorage.getItem('hoangvucMaximizeDamage') === 'true';
                const newSetting = !maximizeDamage;
                localStorage.setItem('hoangvucMaximizeDamage', newSetting);
                const message = newSetting ? 'Đổi ngũ hành để tối đa hoá sát thương' : 'Đổi ngũ hành để không bị giảm sát thương';
                showNotification(`[Hoang vực] ${message}`, 'info');
                updateSettingsIcon();
            });

            parentGroup.appendChild(settingsButton);
            parentGroup.appendChild(hoangVucButton);

            this.updateButtonState('hoangvuc');
            updateSettingsIcon();
        }

        // Phương thức tạo menu "Luận Võ"
        createLuanVoMenu(parentGroup) {
            const luanVoButton = document.createElement('button');
            this.buttonMap.set('luanvo', luanVoButton);
            
            // ⭐ BIẾN QUẢN LÝ AUTO-RERUN
            let luanVoAutoRunTimer = null;
            let luanVoRunCount = 0;
            
            // ⭐ NÚT START/STOP AUTO-RERUN
            const luanVoAutoButton = document.createElement('button');
            luanVoAutoButton.classList.add('custom-script-hoang-vuc-settings-btn');
            luanVoAutoButton.textContent = '▶️';
            luanVoAutoButton.title = 'Tự động chạy lại';
            luanVoAutoButton.style.background = '#4caf50';
            
            // ⭐ NÚT CÀI ĐẶT CHI TIẾT
            const luanVoSettingsButton = document.createElement('button');
            luanVoSettingsButton.classList.add('custom-script-hoang-vuc-settings-btn');
            luanVoSettingsButton.textContent = '⚙️';
            luanVoSettingsButton.title = 'Cài đặt Luận Võ';

            // Khởi tạo giá trị mặc định
            if (localStorage.getItem('luanVoAutoChallenge') === null) localStorage.setItem('luanVoAutoChallenge', '1');
            if (localStorage.getItem('luanVoChallengeMode') === null) localStorage.setItem('luanVoChallengeMode', 'auto');
            if (localStorage.getItem('luanVoTargetUserId') === null) localStorage.setItem('luanVoTargetUserId', '');
            if (localStorage.getItem('luanVoJoinBattle') === null) localStorage.setItem('luanVoJoinBattle', '1');
            if (localStorage.getItem('luanVoEnableAutoAccept') === null) localStorage.setItem('luanVoEnableAutoAccept', '1');
            if (localStorage.getItem('luanVoAutoRerunEnabled') === null) localStorage.setItem('luanVoAutoRerunEnabled', '0');
            if (localStorage.getItem('luanVoRerunDelaySeconds') === null) localStorage.setItem('luanVoRerunDelaySeconds', '30');
            if (localStorage.getItem('luanVoRerunMaxCount') === null) localStorage.setItem('luanVoRerunMaxCount', '200');
            if (localStorage.getItem('luanVoReceiveReward') === null) localStorage.setItem('luanVoReceiveReward', '1');
            if (localStorage.getItem('luanVoChangeElement') === null) localStorage.setItem('luanVoChangeElement', '0');

            // Tạo modal cài đặt
            const createSettingsModal = () => {
                const oldModal = document.getElementById('luanvo-settings-modal');
                if (oldModal) oldModal.remove();

                const modal = document.createElement('div');
                modal.id = 'luanvo-settings-modal';
                modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 999999; display: flex; align-items: center; justify-content: center;`;

                const panel = document.createElement('div');
                panel.style.cssText = `background: #2d2d2d; border-radius: 8px; padding: 15px; max-width: 420px; width: 90%; color: #fff; box-shadow: 0 10px 40px rgba(0,0,0,0.5);`;

                const challengeMode = localStorage.getItem('luanVoChallengeMode') || 'auto';
                const targetUserId = localStorage.getItem('luanVoTargetUserId') || '';
                const joinBattle = localStorage.getItem('luanVoJoinBattle') === '1';
                const enableAutoAccept = localStorage.getItem('luanVoEnableAutoAccept') === '1';
                const rerunDelaySeconds = localStorage.getItem('luanVoRerunDelaySeconds') || '30';
                const rerunMaxCount = localStorage.getItem('luanVoRerunMaxCount') || '200';
                const receiveReward = localStorage.getItem('luanVoReceiveReward') === '1';
                const changeElement = localStorage.getItem('luanVoChangeElement') === '1';

                panel.innerHTML = `
                    <h3 style="margin: 0 0 12px 0; color: #4fc3f7; font-size: 18px;">⚙️ Cài đặt Luận Võ</h3>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
                        <div>
                            <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #ffd700;">🎯 Chế độ:</label>
                            <select id="luanvo-challenge-mode" style="width: 100%; padding: 6px; border-radius: 4px; background: #1a1a1a; color: #fff; border: 1px solid #555; font-size: 12px;">
                                <option value="auto" ${challengeMode === 'auto' ? 'selected' : ''}>Tự động</option>
                                <option value="manual" ${challengeMode === 'manual' ? 'selected' : ''}>Theo ID</option>
                            </select>
                        </div>
                        <div id="target-user-container" style="${challengeMode === 'auto' ? 'display: none;' : ''}">
                            <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #ffd700;">👤 ID:</label>
                            <input type="text" id="luanvo-target-user-id" value="${targetUserId}" placeholder="Nhập ID..." style="width: 100%; padding: 6px; border-radius: 4px; background: #1a1a1a; color: #fff; border: 1px solid #555; font-size: 12px;">
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; font-size: 12px;">
                        <label style="display: flex; align-items: center; padding: 6px 8px; background: #1a1a1a; border-radius: 4px; cursor: pointer;">
                            <input type="checkbox" id="luanvo-join-battle" ${joinBattle ? 'checked' : ''} style="width: 14px; height: 14px; margin-right: 6px;">
                            <span>⚔️ Tham gia</span>
                        </label>
                        <label style="display: flex; align-items: center; padding: 6px 8px; background: #1a1a1a; border-radius: 4px; cursor: pointer;">
                            <input type="checkbox" id="luanvo-enable-auto-accept" ${enableAutoAccept ? 'checked' : ''} style="width: 14px; height: 14px; margin-right: 6px;">
                            <span>✅ Auto chấp nhận</span>
                        </label>
                    </div>

                    <div style="border-top: 1px solid #444; padding-top: 10px; margin-top: 10px;">
                        <div style="color: #ff9800; font-weight: bold; margin-bottom: 8px; font-size: 13px;">🔄 Tự động chạy lại sau khi nhận thưởng:</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                            <div>
                                <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #aaa;">⏱️ Delay (giây):</label>
                                <input type="number" id="luanvo-rerun-delay" value="${rerunDelaySeconds}" min="1" max="3600" style="width: 100%; padding: 6px; border-radius: 4px; background: #1a1a1a; color: #fff; border: 1px solid #555; font-size: 12px;">
                            </div>
                            <div>
                                <label style="display: block; margin-bottom: 4px; font-size: 12px; color: #aaa;">🔢 Số lần:</label>
                                <input type="number" id="luanvo-rerun-max" value="${rerunMaxCount}" min="1" max="9999" style="width: 100%; padding: 6px; border-radius: 4px; background: #1a1a1a; color: #fff; border: 1px solid #555; font-size: 12px;">
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 4px; font-size: 12px;">
                            <label style="display: flex; align-items: center; padding: 6px 8px; background: #1a1a1a; border-radius: 4px; cursor: pointer;">
                                <input type="checkbox" id="luanvo-receive-reward" ${receiveReward ? 'checked' : ''} style="width: 14px; height: 14px; margin-right: 6px;">
                                <span>🎁 Nhận thưởng (5 lần)</span>
                            </label>
                            <label style="display: flex; align-items: center; padding: 6px 8px; background: #1a1a1a; border-radius: 4px; cursor: pointer;">
                                <input type="checkbox" id="luanvo-change-element" ${changeElement ? 'checked' : ''} style="width: 14px; height: 14px; margin-right: 6px;">
                                <span>🔄 Đổi ngũ hành (5 lần)</span>
                            </label>
                        </div>
                        <small style="color: #888; display: block; margin-top: 4px; font-size: 11px;">💡 Dùng nút ▶️ bên ngoài để bật/tắt</small>
                    </div>

                    <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 12px;">
                        <button id="luanvo-cancel-btn" style="padding: 8px 16px; border: none; border-radius: 4px; background: #555; color: #fff; cursor: pointer; font-size: 12px;">Hủy</button>
                        <button id="luanvo-save-btn" style="padding: 8px 16px; border: none; border-radius: 4px; background: #4caf50; color: #fff; cursor: pointer; font-weight: bold; font-size: 12px;">💾 Lưu</button>
                    </div>
                `;

                modal.appendChild(panel);
                document.body.appendChild(modal);

                const modeSelect = panel.querySelector('#luanvo-challenge-mode');
                const targetContainer = panel.querySelector('#target-user-container');
                modeSelect.addEventListener('change', () => {
                    targetContainer.style.display = modeSelect.value === 'manual' ? 'block' : 'none';
                });

                panel.querySelector('#luanvo-cancel-btn').onclick = () => modal.remove();
                modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

                panel.querySelector('#luanvo-save-btn').onclick = () => {
                    const mode = panel.querySelector('#luanvo-challenge-mode').value;
                    const userId = panel.querySelector('#luanvo-target-user-id').value.trim();
                    const joinBattleChecked = panel.querySelector('#luanvo-join-battle').checked;
                    const autoAcceptChecked = panel.querySelector('#luanvo-enable-auto-accept').checked;
                    const delaySeconds = panel.querySelector('#luanvo-rerun-delay').value;
                    const maxCount = panel.querySelector('#luanvo-rerun-max').value;
                    const receiveRewardChecked = panel.querySelector('#luanvo-receive-reward').checked;
                    const changeElementChecked = panel.querySelector('#luanvo-change-element').checked;

                    if (mode === 'manual' && !userId) {
                        showNotification('❌ Vui lòng nhập ID người chơi!', 'error');
                        return;
                    }

                    localStorage.setItem('luanVoChallengeMode', mode);
                    localStorage.setItem('luanVoTargetUserId', userId);
                    localStorage.setItem('luanVoJoinBattle', joinBattleChecked ? '1' : '0');
                    localStorage.setItem('luanVoEnableAutoAccept', autoAcceptChecked ? '1' : '0');
                    localStorage.setItem('luanVoRerunDelaySeconds', delaySeconds);
                    localStorage.setItem('luanVoRerunMaxCount', maxCount);
                    localStorage.setItem('luanVoReceiveReward', receiveRewardChecked ? '1' : '0');
                    localStorage.setItem('luanVoChangeElement', changeElementChecked ? '1' : '0');
                    localStorage.setItem('luanVoAutoChallenge', '1');

                    showNotification('✅ Đã lưu cài đặt!', 'success');
                    modal.remove();
                };
            };

            // Logic Auto-Rerun
            const startAutoRerun = async () => {
                // ⭐ BƯỚC 1: KIỂM TRA LUẬN VÕ ĐÃ HOÀN THÀNH CHƯA
                const accountId = await getAccountId();
                if (!accountId) {
                    showNotification('❌ Không lấy được Account ID!', 'error');
                    return;
                }
                
                const isDone = taskTracker.isTaskDone(accountId, 'luanvo');
                if (!isDone) {
                    showNotification('⚠️ Luận Võ chưa hoàn thành! Vui lòng hoàn thành Luận Võ trước khi bật tự động chạy lại.', 'warn');
                    stopAutoRerun();
                    return;
                }
                
                // ⭐ BƯỚC 2: ĐỌC CÀI ĐẶT
                const delaySeconds = parseInt(localStorage.getItem('luanVoRerunDelaySeconds') || '120');
                const maxCount = parseInt(localStorage.getItem('luanVoRerunMaxCount') || '200');
                const shouldReceiveReward = localStorage.getItem('luanVoReceiveReward') === '1';
                const shouldChangeElement = localStorage.getItem('luanVoChangeElement') === '1';
                
                luanVoRunCount = 0;
                
                // ⭐ BƯỚC 3: VÒNG LẶP CHẠY LIÊN TỤC
                const runCycle = async () => {
                    // ⭐ KIỂM TRA XEM CÓ NÊN TIẾP TỤC HAY KHÔNG
                    if (!luanVoAutoRunTimer) {
                        console.log('[Luận Võ Auto] ⏹️ Đã bị dừng, không tiếp tục.');
                        return;
                    }
                    
                    if (luanVoRunCount >= maxCount) {
                        showNotification(`✅ Đã chạy đủ ${maxCount} lần. Dừng lại.`, 'success');
                        stopAutoRerun();
                        return;
                    }
                    
                    luanVoRunCount++;
                    console.log(`[Luận Võ Auto] 🔄 Lần ${luanVoRunCount}/${maxCount}`);
                    
                    luanVoButton.disabled = true;
                    luanVoButton.textContent = `⏳ Đang chạy lần ${luanVoRunCount}/${maxCount}`;
                    
                    try {
                        // ⭐ NHẬN THƯỞNG (nếu checkbox bật)
                        if (shouldReceiveReward) {
                            console.log('[Luận Võ Auto] 🎁 Đang nhận thưởng...');
                            const nonce = await getNonce();
                            if (nonce) {
                                for(let attempt = 1; attempt <= 5; attempt++) {
                                    // Kiểm tra có bị dừng giữa chừng không
                                    if (!luanVoAutoRunTimer) return;
                                    await luanvo.receiveReward(nonce);
                                    await new Promise(resolve => setTimeout(resolve, 1000));
                                }
                            }
                        }
                        
                        // ⭐ ĐỔI NGŨ HÀNH 5 LẦN (nếu checkbox bật)
                        if (shouldChangeElement) {
                            console.log('[Luận Võ Auto] 🔄 Đang đổi ngũ hành 5 lần...');
                            const hoangVucUrl = `${weburl}hoang-vuc?t`;
                            const { nonce } = await this.getNonceAndRemainingAttacks(hoangVucUrl);
                            if (nonce) {
                                const ajaxUrl = `${weburl}wp-content/themes/halimmovies-child/hh3d-ajax.php`;
                                const headers = {
                                    "accept": "application/json, text/javascript, */*;q=0.01",
                                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                                    'X-Requested-With': 'XMLHttpRequest',
                                    "referer": hoangVucUrl,
                                };
                                let currentElement = '';
                                for (let i = 1; i <= 5; i++) {
                                    // Kiểm tra có bị dừng giữa chừng không
                                    if (!luanVoAutoRunTimer) return;
                                    
                                    const changeData = await (await fetch(ajaxUrl, {
                                        method: 'POST',
                                        headers: headers,
                                        body: `action=change_user_element&nonce=${nonce}`,
                                        credentials: 'include'
                                    })).json();
                                    showNotification(`[Luận Võ Auto] ${JSON.stringify(changeData)} `);
                                    if (changeData.success) {
                                        const newElement = changeData.data.new_element;
                                        console.log(`[Luận Võ Auto] 🔄 Đổi lần ${i}/5 -> ${newElement}`);
                                        currentElement += newElement + '->';
                                        await new Promise(resolve => setTimeout(resolve, 500));
                                    } else {
                                        console.error(`[Luận Võ Auto] ❌ Lỗi khi đổi ngũ hành lần ${i}:`, changeData.message || 'Không xác định.');
                                    }
                                }
                                if(currentElement === '') currentElement = 'Không xác định';
                                else currentElement = currentElement.slice(0, -2); // Bỏ đi mũi tên cuối cùng
                                showNotification(`✅ Đã đổi ngũ hành 5 lần! ${currentElement}`, 'success');
                            }
                        }
                        
                        // ⭐ Kiểm tra lại trước khi tiếp tục
                        if (!luanVoAutoRunTimer) {
                            console.log('[Luận Võ Auto] ⏹️ Đã bị dừng sau khi hoàn thành tác vụ.');
                            return;
                        }
                        
                        // ⭐ Thông báo kết quả chạy thành công
                        showNotification(`✅ Hoàn tất lần ${luanVoRunCount}/${maxCount}!`, 'success');
                        
                        if (luanVoRunCount < maxCount && luanVoAutoRunTimer) {
                            const nextRunTime = new Date(Date.now() + delaySeconds * 1000);
                            showNotification(`⏰ Sẽ chạy lần ${luanVoRunCount + 1}/${maxCount} lúc ${nextRunTime.toLocaleTimeString('vi-VN')}`, 'info');
                            
                            // Cập nhật text nút với số lần đã chạy
                            luanVoButton.textContent = `Luận Võ (${luanVoRunCount}/${maxCount})`;
                            luanVoButton.disabled = false;
                            
                            luanVoAutoRunTimer = setTimeout(runCycle, delaySeconds * 1000);
                        } else {
                            showNotification(`🎉 Hoàn thành ${maxCount} lần chạy!`, 'success');
                            stopAutoRerun();
                        }
                    } catch (error) {
                        console.error('[Luận Võ Auto] Lỗi:', error);
                        showNotification(`❌ Lần ${luanVoRunCount}/${maxCount} thất bại: ${error.message || 'Lỗi không xác định'}`, 'error');
                        stopAutoRerun();
                    } finally {
                        if (luanVoRunCount >= maxCount || !luanVoAutoRunTimer) {
                            luanVoButton.textContent = 'Luận Võ';
                            luanVoButton.disabled = false;
                            this.updateButtonState('luanvo');
                        }
                    }
                };
                
                showNotification(`🚀 Bắt đầu auto-rerun: ${maxCount} lần, mỗi ${delaySeconds} giây`, 'success');
                // ⭐ Khởi tạo timer = true để đánh dấu đang chạy trước khi gọi runCycle() lần đầu
                luanVoAutoRunTimer = true;
                runCycle();
            };
            
            const stopAutoRerun = () => {
                if (luanVoAutoRunTimer) {
                    clearTimeout(luanVoAutoRunTimer);
                    luanVoAutoRunTimer = null;
                }
                const wasRunning = luanVoRunCount > 0;
                luanVoRunCount = 0;
                localStorage.setItem('luanVoAutoRerunEnabled', '0');
                luanVoAutoButton.textContent = '▶️';
                luanVoAutoButton.title = 'Bật tự động chạy lại';
                luanVoAutoButton.style.background = '#4caf50';
                luanVoButton.textContent = 'Luận Võ';
                luanVoButton.disabled = false;
                
                if (wasRunning) {
                    showNotification('⏹️ Đã dừng auto-rerun Luận Võ', 'info');
                }
            };
            
            // Sự kiện nút Auto
            luanVoAutoButton.addEventListener('click', () => {
                const isRunning = localStorage.getItem('luanVoAutoRerunEnabled') === '1';
                
                if (isRunning) {
                    stopAutoRerun();
                } else {
                    localStorage.setItem('luanVoAutoRerunEnabled', '1');
                    luanVoAutoButton.textContent = '⏸️';
                    luanVoAutoButton.title = 'Dừng tự động chạy lại';
                    luanVoAutoButton.style.background = '#f44336';
                    startAutoRerun();
                }
            });

            luanVoSettingsButton.addEventListener('click', createSettingsModal);
            
            parentGroup.appendChild(luanVoAutoButton);
            parentGroup.appendChild(luanVoSettingsButton);

            luanVoButton.textContent = 'Luận Võ';
            luanVoButton.classList.add('custom-script-menu-button', 'custom-script-auto-btn');
            luanVoButton.addEventListener('click', async () => {
                luanVoButton.disabled = true;
                luanVoButton.textContent = 'Đang xử lý...';
                try {
                    await luanvo.doLuanVo(true);
                } finally {
                    luanVoButton.textContent = 'Luận Võ';
                    this.updateButtonState('luanvo');
                }
            });

            parentGroup.appendChild(luanVoButton);
            this.updateButtonState('luanvo')
        }
        async getNonceAndRemainingAttacks(url) {
            const logPrefix = '[Hoang Vực]';
            console.log(`${logPrefix} ▶️ Đang tải trang từ ${url}...`);
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const html = await response.text();

                // Regex 1: lấy số lượt đánh
                const attacksMatch = html.match(/<div class="remaining-attacks">Lượt đánh còn lại:\s*(\d+)<\/div>/);
                const remainingAttacks = attacksMatch ? parseInt(attacksMatch[1], 10) : null;

                // Regex 2: lấy nonce
                const nonceMatch = html.match(/var ajax_boss_nonce = '([a-f0-9]+)'/);
                const nonce = nonceMatch ? nonceMatch[1] : null;

                console.log(`${logPrefix} ✅ Lấy dữ liệu thành công.`);
                return { remainingAttacks, nonce };

            } catch (e) {
                console.error(`${logPrefix} ❌ Lỗi khi tải trang hoặc trích xuất dữ liệu:`, e);
                return { remainingAttacks: null, nonce: null };
            }
        }

        // Phương thức tạo menu "Autorun"
        createAutorunMenu(parentGroup) {
            const container = document.createElement('div');
            container.classList.add('custom-script-khoang-mach-container');
            parentGroup.appendChild(container);

            const buttonRow = document.createElement('div');
            buttonRow.classList.add('custom-script-khoang-mach-button-row');
            const autorunButton = document.createElement('button');
            this.buttonMap.set('autorun', autorunButton);
            const autorunSettingsButton = document.createElement('button');
            autorunSettingsButton.classList.add('custom-script-hoang-vuc-settings-btn');

            if (localStorage.getItem('autorunEnabled') === null) {
                localStorage.setItem('autorunEnabled', '1');
            }
            let autorunEnabled = localStorage.getItem('autorunEnabled') === '1';

            const updateSettingButtonState = (isEnabled) => {
                autorunSettingsButton.textContent = isEnabled ? '✅' : '❌';
                autorunSettingsButton.title = isEnabled ? 'Tự động chạy Autorun khi tải: Bật' : 'Tự động chạy Autorun khi tải: Tắt';
            };
            updateSettingButtonState(autorunEnabled);


            autorunSettingsButton.addEventListener('click', () => {
                autorunEnabled = !autorunEnabled;
                localStorage.setItem('autorunEnabled', autorunEnabled ? '1' : '0');
                updateSettingButtonState(autorunEnabled);
                const message = autorunEnabled ? 'Tự động chạy Autorun khi tải đã được bật' : 'Tự động chạy Autorun khi tải đã được tắt';
                showNotification(message, 'info');
            });

            autorunButton.textContent = 'Autorun';
            autorunButton.classList.add('custom-script-menu-button', 'custom-script-auto-btn');
            autorunButton.addEventListener('click', async () => {
                this.autorunIsRunning = !this.autorunIsRunning
                this.updateButtonState('autorun');
                if (this.autorunIsRunning) {
                    await automatic.start();
                } else {
                    await automatic.stop();
                }
            });

            const autorunConfigButton = document.createElement('button');
            autorunConfigButton.classList.add('custom-script-hoang-vuc-settings-btn');
            autorunConfigButton.textContent = '⚙️';
            autorunConfigButton.title = 'Cấu hình Autorun';

            const configDiv = document.createElement('div');
            configDiv.style.display = 'none';
            configDiv.classList.add('custom-script-settings-panel');
            configDiv.innerHTML = `
            <div class="custom-script-khoang-mach-config-group checkbox-group">
                <input type="checkbox" id="autoDiemDanh" checked>
                <label for="autoDiemDanh">Điểm Danh, Tế Lễ, Vấn Đáp</label>
            </div>
            <div class="custom-script-khoang-mach-config-group checkbox-group">
                <input type="checkbox" id="autoThiLuyen" checked>
                <label for="autoThiLuyen">Thí Luyện</label>
            </div>
            <div class="custom-script-khoang-mach-config-group checkbox-group">
                <input type="checkbox" id="autoPhucLoi" checked>
                <label for="autoPhucLoi">Phúc Lợi Đường</label>
            </div>
            <div class="custom-script-khoang-mach-config-group checkbox-group">

                <input type="checkbox" id="autoHoangVuc" checked>
                <label for="autoHoangVuc">Hoang Vực</label>
            </div>
            <div class="custom-script-khoang-mach-config-group checkbox-group">
                <input type="checkbox" id="autoBiCanh" checked>
                <label for="autoBiCanh">Bí Cảnh</label>
            </div>
            <div class="custom-script-khoang-mach-config-group checkbox-group">
                <input type="checkbox" id="autoLuanVo" checked>
                <label for="autoLuanVo">Luận Võ</label>
            </div>
            <div class="custom-script-khoang-mach-config-group checkbox-group">
                <input type="checkbox" id="autoDoThach" checked>
                <label for="autoDoThach">Đổ Thạch</label>
            </div>
            <div class="custom-script-khoang-mach-config-group checkbox-group">
                <input type="checkbox" id="autoKhoangMach" checked>
                <label for="autoKhoangMach">Khoáng Mạch</label>
            </div>

            <div class="custom-script-khoang-mach-config-group checkbox-group">
                <input type="checkbox" id="autoTienDuyen" checked>
                <label for="autoTienDuyen">Tiên Duyên</label>
            </div>
            `;
            autorunConfigButton.addEventListener('click', () => {
                if (configDiv.style.display === 'none') {
                    configDiv.style.display = 'flex';
                } else {
                    configDiv.style.display = 'none';
                }
            });

            const autoDiemDanhCheckbox = configDiv.querySelector('#autoDiemDanh');
            const autoThiLuyenCheckbox = configDiv.querySelector('#autoThiLuyen');
            const autoPhucLoiCheckbox = configDiv.querySelector('#autoPhucLoi');
            const autoHoangVucCheckbox = configDiv.querySelector('#autoHoangVuc');
            const autoBiCanhCheckbox = configDiv.querySelector('#autoBiCanh');
            const autoLuanVoCheckbox = configDiv.querySelector('#autoLuanVo');
            const autoDoThachCheckbox = configDiv.querySelector('#autoDoThach');
            const autoKhoangMachCheckbox = configDiv.querySelector('#autoKhoangMach');
            const autoTienDuyenCheckbox = configDiv.querySelector('#autoTienDuyen');

            // Khôi phục trạng thái từ localStorage
            autoDiemDanhCheckbox.checked = localStorage.getItem('autoDiemDanh') !== '0';
            autoThiLuyenCheckbox.checked = localStorage.getItem('autoThiLuyen') !== '0';
            autoPhucLoiCheckbox.checked = localStorage.getItem('autoPhucLoi') !== '0';
            autoHoangVucCheckbox.checked = localStorage.getItem('autoHoangVuc') !== '0';
            autoBiCanhCheckbox.checked = localStorage.getItem('autoBiCanh') !== '0';
            autoLuanVoCheckbox.checked = localStorage.getItem('autoLuanVo') !== '0';
            autoDoThachCheckbox.checked = localStorage.getItem('autoDoThach') !== '0';
            autoKhoangMachCheckbox.checked = localStorage.getItem('autoKhoangMach') !== '0';
            autoTienDuyenCheckbox.checked = localStorage.getItem('autoTienDuyen') !== '0';

            // Lưu trạng thái vào localStorage khi thay đổi
            autoDiemDanhCheckbox.addEventListener('change', () => {
                localStorage.setItem('autoDiemDanh', autoDiemDanhCheckbox.checked ? '1' : '0');
            });
            autoThiLuyenCheckbox.addEventListener('change', () => {
                localStorage.setItem('autoThiLuyen', autoThiLuyenCheckbox.checked ? '1' : '0');
            });
            autoPhucLoiCheckbox.addEventListener('change', () => {
                localStorage.setItem('autoPhucLoi', autoPhucLoiCheckbox.checked ? '1' : '0');
            });
            autoHoangVucCheckbox.addEventListener('change', () => {
                localStorage.setItem('autoHoangVuc', autoHoangVucCheckbox.checked ? '1' : '0');
            });
            autoBiCanhCheckbox.addEventListener('change', () => {
                localStorage.setItem('autoBiCanh', autoBiCanhCheckbox.checked ? '1' : '0');
            });
            autoLuanVoCheckbox.addEventListener('change', () => {
                localStorage.setItem('autoLuanVo', autoLuanVoCheckbox.checked ? '1' : '0');
            });
            autoDoThachCheckbox.addEventListener('change', () => {
                localStorage.setItem('autoDoThach', autoDoThachCheckbox.checked ? '1' : '0');
            });
            autoKhoangMachCheckbox.addEventListener('change', () => {
                localStorage.setItem('autoKhoangMach', autoKhoangMachCheckbox.checked ? '1' : '0');
            });
            autoTienDuyenCheckbox.addEventListener('change', () => {
                localStorage.setItem('autoTienDuyen', autoTienDuyenCheckbox.checked ? '1' : '0');
            });

            buttonRow.appendChild(autorunSettingsButton);
            buttonRow.appendChild(autorunButton);
            buttonRow.appendChild(autorunConfigButton);
            container.appendChild(buttonRow);
            container.appendChild(configDiv);
            parentGroup.appendChild(container);
            this.updateButtonState('autorun');
        }

        // Phương thức tạo menu "Bí Cảnh"
        async createBiCanhMenu(parentGroup) {
            const biCanhButton = document.createElement('button');
            this.buttonMap.set('bicanh', biCanhButton);
            biCanhButton.textContent = 'Bí Cảnh';
            biCanhButton.classList.add('custom-script-menu-button', 'custom-script-auto-btn');

            biCanhButton.addEventListener('click', async () => {
                biCanhButton.disabled = true;
                biCanhButton.textContent = 'Đang xử lý...';
                try {
                    await bicanh.doBiCanh();
                } finally {
                    biCanhButton.textContent = 'Bí Cảnh';
                    this.updateButtonState('bicanh');
                }
            });
            parentGroup.appendChild(biCanhButton);
            this.updateButtonState('bicanh');
        }

        // Phương thức tạo menu "Khoáng Mạch"
        async createKhoangMachMenu(parentGroup) {
            const { minesData } = await khoangmach.getAllMines();

            // Lấy danh sách mỏ yêu thích từ localStorage
            const getFavoriteMineIds = () => {
                const favoriteIds = new Set();
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    // Kiểm tra pattern: favorite_mine_{accountId}_{mineId}
                    const match = key.match(/^favorite_mine_(\d+)_(\d+)$/);
                    if (match && match[1] === String(accountId)) {
                        favoriteIds.add(match[2]); // mineId
                    }
                }
                return favoriteIds;
            };

            // Sinh options HTML với mỏ yêu thích lên đầu và tô màu vàng
            const buildMineOptionsHtml = () => {
                const favoriteIds = getFavoriteMineIds();
                
                // Tách mỏ yêu thích và không yêu thích
                const favoriteMines = minesData.filter(m => favoriteIds.has(String(m.id)));
                const normalMines = minesData.filter(m => !favoriteIds.has(String(m.id)));

                const generateOption = (mine, isFavorite) => {
                    let typePrefix = '';
                    if (mine.type === 'gold') typePrefix = '[Thượng] ';
                    else if (mine.type === 'silver') typePrefix = '[Trung] ';
                    else if (mine.type === 'copper') typePrefix = '[Hạ] ';
                    
                    const starPrefix = isFavorite ? '⭐ ' : '';
                    const style = isFavorite ? 'style="background-color: #ffeb3b; color: #000;"' : '';
                    return `<option value="${mine.id}" ${style}>${starPrefix}${typePrefix}${mine.name} (${mine.id})</option>`;
                };

                // Mỏ yêu thích lên đầu
                const favoriteHtml = favoriteMines.map(m => generateOption(m, true)).join('');
                const normalHtml = normalMines.map(m => generateOption(m, false)).join('');

                return favoriteHtml + normalHtml;
            };

            const optionsHtml = buildMineOptionsHtml();

            const container = document.createElement('div');
            container.classList.add('custom-script-khoang-mach-container');

            const buttonRow = document.createElement('div');
            buttonRow.classList.add('custom-script-khoang-mach-button-row');

            const khoangMachButton = document.createElement('button');
            khoangMachButton.classList.add('custom-script-khoang-mach-button');
            khoangMachButton.textContent = 'Khoáng Mạch';
            this.buttonMap.set('khoangmach', khoangMachButton);

            const khoangMachSettingsButton = document.createElement('button');
            khoangMachSettingsButton.classList.add('custom-script-hoang-vuc-settings-btn');
            khoangMachSettingsButton.textContent = '⚙️';

            const khoangMachSearchConfigButton = document.createElement('button');
            khoangMachSearchConfigButton.classList.add('custom-script-hoang-vuc-settings-btn');
            khoangMachSearchConfigButton.textContent = '🔍';
            khoangMachSearchConfigButton.title = 'Cấu hình ìm kẻ địch';

            buttonRow.appendChild(khoangMachSettingsButton);
            buttonRow.appendChild(khoangMachButton);
            buttonRow.appendChild(khoangMachSearchConfigButton);

            const configDiv = document.createElement('div');
            configDiv.style.display = 'none';
            configDiv.classList.add('custom-script-settings-panel');
            configDiv.innerHTML = `
            <div class="custom-script-khoang-mach-config-group">
                <label for="specificMineSelect">Chọn Khoáng Mạch:</label>
                <select id="specificMineSelect">${optionsHtml}</select>
            </div>
            <div class="custom-script-khoang-mach-config-group">
                <label for="rewardModeSelect">Chế độ Nhận Thưởng:</label>
                <select id="rewardModeSelect">
                <option value="110">110%</option>
                <option value="100">100%</option>
                <option value="20">20%</option>
                <option value="any">Bất kỳ</option>
                </select>
            </div>
            <div class="custom-script-khoang-mach-config-group">
                <label for="rewardTimeSelect">Nhận thưởng khi thời gian đạt:</label>
                <select id="rewardTimeSelect">
                <option value="max">Đạt tối đa</option>
                <option value="20">20 phút</option>
                <option value="10">10 phút</option>
                <option value="4">4 phút</option>
                <option value="2">2 phút</option>
                </select>
            </div>
            <div class="custom-script-khoang-mach-config-group checkbox-group">
                <input type="checkbox" id="autoTakeOver">
                <label for="autoTakeOver">Tự động đoạt mỏ khi chưa buff</label>
            </div>
            <div class="custom-script-khoang-mach-config-group checkbox-group">
                <input type="checkbox" id="autoTakeOverRotation">
                <label for="autoTakeOverRotation">Tự động đoạt mỏ khi có thể (đảo key)</label>
            </div>
            <div class="custom-script-khoang-mach-config-group checkbox-group">
                <input type="checkbox" id="leaveMineToClaimReward" checked>
                <label for="leaveMineToClaimReward">Rời mỏ để nhận thưởng (cao tầng đảo key)</label>
            </div>
            <div class="custom-script-khoang-mach-config-group checkbox-group">
                <input type="checkbox" id="autoBuff">
                <label for="autoBuff">Tự động mua Linh Quang Phù</label>
            </div>
            <div class="custom-script-khoang-mach-config-group checkbox-group">
                <input type="checkbox" id="outerNotification" checked>
                <label for="outerNotification">Thông báo ngoại tông vào khoáng</label>
            </div>
            <div class="custom-script-khoang-mach-config-group checkbox-group">
                <input type="checkbox" id="fastAttack" checked>
                <label for="fastAttack">Bỏ qua thời gian chờ khi tấn công</label>
            </div>
            <div class="custom-script-khoang-mach-config-group number-input-group">
                <label for="checkInterval" align="left" title="Khoảng thời gian (phút) để kiểm tra và thực hiện các hành động liên quan đến Khoáng Mạch.">Thời gian kiểm tra khoáng (phút)</label>
                <input type="number" id="checkInterval" value="5" style="width: 50px;">
            </div>
            `;

            container.appendChild(buttonRow);
            container.appendChild(configDiv);
            parentGroup.appendChild(container);

            const searchConfigContainer = document.createElement('div');
            searchConfigContainer.style.display = 'none';
            searchConfigContainer.classList.add('custom-script-khoang-mach-container');
            const searchEnemiesInput = document.createElement('input');
            searchEnemiesInput.type = 'text';
            searchEnemiesInput.placeholder = 'Nhập ID kẻ địch, ví dụ: 12345;67890;65454';
            searchEnemiesInput.style.width = '100%';
            searchConfigContainer.appendChild(searchEnemiesInput);
            const searchTongMonRow = document.createElement('div');
            searchTongMonRow.classList.add('custom-script-khoang-mach-button-row');
            const searchTongMonInput = document.createElement('input');
            searchTongMonInput.type = 'text';
            searchTongMonInput.placeholder = 'Nhập id Tông Môn, ví dụ: 57264;57265';
            searchTongMonInput.style.width = '100%';
            const searchTongMonViewButton = document.createElement('button');
            searchTongMonViewButton.textContent = '👁';
            searchTongMonViewButton.classList.add('custom-script-khoang-mach-button');
            searchTongMonRow.appendChild(searchTongMonInput);
            searchTongMonRow.appendChild(searchTongMonViewButton);
            searchConfigContainer.appendChild(searchTongMonRow);
            container.appendChild(searchConfigContainer);

            const searchButtonRow = document.createElement('div');
            searchButtonRow.classList.add('custom-script-khoang-mach-button-row');
            searchConfigContainer.appendChild(searchButtonRow);

            const searchButton = document.createElement('button');
            searchButton.classList.add('custom-script-khoang-mach-button');
            searchButton.textContent = 'Bắt đầu tìm kiếm';
            searchButton.title = 'Bắt đầu tìm kiếm kẻ địch trong khoáng mạch';
            searchButtonRow.appendChild(searchButton);
            const tongMonContainer = document.createElement('div');
            searchConfigContainer.appendChild(tongMonContainer);
            const viewResultsButton = document.createElement('button');
            viewResultsButton.classList.add('custom-script-khoang-mach-button');
            viewResultsButton.textContent = 'Xem kết quả';
            viewResultsButton.title = 'Xem kết quả tìm kiếm kẻ địch';
            searchButtonRow.appendChild(viewResultsButton);
            const searchResultSaved = sessionStorage.getItem(`khoangmach_enemy_search_results`);
            const parsed = searchResultSaved ? JSON.parse(searchResultSaved) : null;

            // Tự động tìm mảng thật sự dù nó là kiểu cũ (Array) hay kiểu mới (Object.results)
            const realData = Array.isArray(parsed) ? parsed : (parsed?.results || []);

            // Disable nếu không có dữ liệu thật
            if (realData.length === 0) {
                viewResultsButton.disabled = true;
            }

            const specificMineSelect = configDiv.querySelector('#specificMineSelect');
            const rewardModeSelect = configDiv.querySelector('#rewardModeSelect');
            const rewardTimeSelect = configDiv.querySelector('#rewardTimeSelect');
            const autoTakeOverCheckbox = configDiv.querySelector('#autoTakeOver');
            const autoTakeOverRotationCheckbox = configDiv.querySelector('#autoTakeOverRotation');
            const leaveMineToClaimRewardCheckbox = configDiv.querySelector('#leaveMineToClaimReward');
            const autoBuffCheckbox = configDiv.querySelector('#autoBuff');
            const outerNotificationCheckbox = configDiv.querySelector('#outerNotification');
            const fastAttackCheckbox = configDiv.querySelector('#fastAttack');
            const checkIntervalInput = configDiv.querySelector('#checkInterval');

            const keyMine = `khoangmach_selected_mine_${accountId}`;
            const savedMineSetting = localStorage.getItem(keyMine);
            if (savedMineSetting) {
                try {
                    const mineInfo = JSON.parse(savedMineSetting);
                    if (mineInfo && mineInfo.id) specificMineSelect.value = mineInfo.id;
                } catch (e) {
                    localStorage.removeItem(keyMine);
                }
            }

            checkIntervalInput.value = localStorage.getItem('khoangmach_check_interval') || '5';
            rewardModeSelect.value = localStorage.getItem('khoangmach_reward_mode') || 'any';
            rewardTimeSelect.value = localStorage.getItem('khoangmach_reward_time') || 'max';
            autoTakeOverCheckbox.checked = localStorage.getItem('khoangmach_auto_takeover') === 'true';
            autoTakeOverRotationCheckbox.checked = localStorage.getItem('khoangmach_auto_takeover_rotation') === 'true';
            leaveMineToClaimRewardCheckbox.checked = localStorage.getItem(`khoangmach_leave_mine_to_claim_reward_${accountId}`) == 'true';
            autoBuffCheckbox.checked = localStorage.getItem('khoangmach_use_buff') === 'true';
            fastAttackCheckbox.checked = localStorage.getItem('khoangmach_fast_attack') === 'true';
            outerNotificationCheckbox.checked = localStorage.getItem('khoangmach_outer_notification') === 'true';

            outerNotificationCheckbox.addEventListener('change', (e) => {
                localStorage.setItem('khoangmach_outer_notification', e.target.checked);
                const status = e.target.checked ? 'Bật' : 'Tắt';
                showNotification(`Thông báo ngoại tông vào khoáng: ${status}`, 'info');
            });

            let settingsOpen = false;
            khoangMachSettingsButton.addEventListener('click', () => {
            settingsOpen = !settingsOpen;
            configDiv.style.display = settingsOpen ? 'block' : 'none';
            khoangMachSettingsButton.title = settingsOpen ? 'Đóng cài đặt Khoáng Mạch' : 'Mở cài đặt Khoáng Mạch';
            });

            specificMineSelect.addEventListener('change', (e) => {
                const selectedId = e.target.value;
                const selectedMine = minesData.find(mine => mine.id === selectedId);
                if (selectedMine && selectedMine.type) {
                    localStorage.setItem(keyMine, JSON.stringify({ id: selectedId, type: selectedMine.type}));
                    showNotification(`Đã chọn mỏ: ${e.target.options[e.target.selectedIndex].text}`, 'info');
                }
            });

            rewardModeSelect.addEventListener('change', (e) => {
            localStorage.setItem('khoangmach_reward_mode', e.target.value);
            showNotification(`Chế độ nhận thưởng: ${e.target.options[e.target.selectedIndex].text}`, 'info');
            });

            rewardTimeSelect.addEventListener('change', (e) => {
                localStorage.setItem('khoangmach_reward_time', e.target.value);
                showNotification(`Nhận thưởng khi thời gian đạt: ${e.target.options[e.target.selectedIndex].text}`, 'info');
            });

            autoTakeOverCheckbox.addEventListener('change', (e) => {
                localStorage.setItem('khoangmach_auto_takeover', e.target.checked);
                if (e.target.checked) {
                    const khoangmach_auto_takeover_rotation =
                        localStorage.getItem('khoangmach_auto_takeover_rotation') === 'true';
                    if (khoangmach_auto_takeover_rotation) {
                        // ❌ TẮT autoTakeOverRotation khi bật autoTakeover
                        autoTakeOverRotationCheckbox.checked = false;
                        localStorage.setItem('khoangmach_auto_takeover_rotation', false);
                    }
                    showNotification('Tự động đoạt mỏ khi chưa buff: Bật', 'info');
                } else {
                    const status = e.target.checked ? 'Bật' : 'Tắt';
                    showNotification(`Tự động đoạt mỏ khi chưa buff: ${status}`,'info');
                }
            });

            autoTakeOverRotationCheckbox.addEventListener('change', (e) => {
                localStorage.setItem('khoangmach_auto_takeover_rotation', e.target.checked);
                const status = e.target.checked ? 'Bật' : 'Tắt';
                showNotification(`Tự động đoạt mỏ khi có thể: ${status}`,'info');
                if (e.target.checked) {
                    // ❌ TẮT autoTakeover khi bật autoTakeoverRotation
                    autoTakeOverCheckbox.checked = false;
                    localStorage.setItem('khoangmach_auto_takeover', false);
                }
            });

            leaveMineToClaimRewardCheckbox.addEventListener('change', (e) => {
                localStorage.setItem(`khoangmach_leave_mine_to_claim_reward_${accountId}`, e.target.checked);
                const status = e.target.checked ? 'Bật' : 'Tắt';
                showNotification(`Rời mỏ để nhận thưởng: ${status}`, 'info');
            });

            autoBuffCheckbox.addEventListener('change', (e) => {
                localStorage.setItem('khoangmach_use_buff', e.target.checked);
                const status = e.target.checked ? 'Bật' : 'Tắt';
                showNotification(`Tự động mua Linh Quang Phù: ${status}`, 'info');
            });

            fastAttackCheckbox.addEventListener('change', (e) => {
                localStorage.setItem('khoangmach_fast_attack', e.target.checked);
                const status = e.target.checked ? 'Bật' : 'Tắt';
                showNotification(`Bỏ qua thời gian chờ khi tấn công: ${status}`, 'info');
            });

            checkIntervalInput.addEventListener('change', (e) => {
                let value = parseInt(e.target.value, 10);
                if (isNaN(value) || value < 0) {
                    value = 0;
                    e.target.value = '0';
                } else if (value > 30) {
                    value = 30;
                    e.target.value = '30';
                }
                localStorage.setItem('khoangmach_check_interval', value.toString());
            });

            // Xử lý sự kiện khoáng mạch
            khoangMachButton.addEventListener('click', async () => {
                khoangMachButton.disabled = true;
                khoangMachButton.textContent = 'Đang xử lý...';
                try {
                    await khoangmach.doKhoangMach();
                }
                finally {
                    khoangMachButton.textContent = 'Khoáng Mạch';
                    this.updateButtonState('khoangmach');
                }
            });

            // Xử lý sự kiện tìm kẻ địch
            khoangMachSearchConfigButton.addEventListener('click', async () => {
                if (searchConfigContainer.style.display === 'block') {
                    searchConfigContainer.style.display = 'none';
                    return;
                }
                searchConfigContainer.style.display = 'block';
            });

            searchEnemiesInput.addEventListener('input', () => {
                localStorage.setItem(`khoangmach_search_enemies_${accountId}`, searchEnemiesInput.value);
            });

            
            // ===== Đồng bộ danh sách Tông Môn (checkbox) <-> searchTongMonInput (gói vào 1 hàm) =====
            const setupTongMonSelectionSync = ({
                accountId,
                searchTongMonInput,
                tongMonContainer,
                viewButton,
                fetchTongMonList,
                notify
            }) => {
                const tongMonSelectionKey = `khoangmach_search_tongmon_${accountId}`;

                /**
                 * Parse chuỗi id dạng "1;2; 3" -> { list: string[], set: Set<string> }
                 */
                const parseIds = (raw) => {
                    const list = (raw || '')
                        .split(';')
                        .map(s => (s || '').trim())
                        .filter(Boolean);

                    const set = new Set();
                    const orderedUnique = [];
                    for (const id of list) {
                        if (!set.has(id)) {
                            set.add(id);
                            orderedUnique.push(id);
                        }
                    }
                    return { list: orderedUnique, set };
                };

                const normalizeValue = (ids) => (ids || []).join(';');

                let checkboxById = new Map();
                let isSyncing = false;
                let loadedOnce = false;

                // Load value từ localStorage vào input ngay khi khởi tạo
                const saved = localStorage.getItem(tongMonSelectionKey) || '';
                if (saved && !searchTongMonInput.value) {
                    searchTongMonInput.value = saved;
                }

                const syncInputValue = (nextValue) => {
                    if (searchTongMonInput.value === nextValue) return;
                    isSyncing = true;
                    try {
                        searchTongMonInput.value = nextValue;
                        localStorage.setItem(tongMonSelectionKey, nextValue);
                    } finally {
                        isSyncing = false;
                    }
                };

                const syncCheckboxesFromInput = () => {
                    if (!checkboxById || checkboxById.size === 0) return;
                    const { set } = parseIds(searchTongMonInput.value);
                    for (const [id, checkbox] of checkboxById.entries()) {
                        checkbox.checked = set.has(id);
                    }
                };

                const renderList = (tongMonList) => {
                    tongMonContainer.innerHTML = '';
                    checkboxById = new Map();

                    tongMonContainer.style.maxHeight = '240px';
                    tongMonContainer.style.overflowY = 'auto';

                    const current = parseIds(searchTongMonInput.value);
                    const currentSet = new Set(current.list);
                    //sort theo cấp giảm dần
                    tongMonList.sort((a, b) => b.level - a.level);
                    for (const tm of (tongMonList || [])) {
                        const row = document.createElement('div');
                        row.classList.add('custom-script-khoang-mach-button-row');
                        row.style.alignItems = 'center';

                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.style.marginRight = '8px';
                        checkbox.checked = currentSet.has(tm.id);
                        checkboxById.set(tm.id, checkbox);
                        //Màu khác nhau cho các cấp khác nhau
                        const label = document.createElement('span');
                        for (let i = 1; i <= 10; i++) {
                            if (tm.level === i) {
                                label.style.color = `hsl(${(i - 1) * 36}, 100%, 50%)`;
                                break;
                            }
                        }
                        label.textContent = `[Cấp ${tm.level}] ${tm.name}`;

                        checkbox.addEventListener('change', () => {
                            const { list } = parseIds(searchTongMonInput.value);
                            const set = new Set(list);

                            if (checkbox.checked) {
                                if (!set.has(tm.id)) list.push(tm.id);
                            } else {
                                const idx = list.indexOf(tm.id);
                                if (idx !== -1) list.splice(idx, 1);
                            }

                            syncInputValue(normalizeValue(list));
                        });

                        row.appendChild(checkbox);
                        row.appendChild(label);
                        tongMonContainer.appendChild(row);
                    }

                    // đảm bảo checkbox phản ánh đúng input
                    syncCheckboxesFromInput();
                };

                // Input -> Checkbox
                searchTongMonInput.addEventListener('input', () => {
                    localStorage.setItem(tongMonSelectionKey, searchTongMonInput.value);
                    if (!isSyncing) syncCheckboxesFromInput();
                });

                // Button 👁 -> load + render (toggle hiển thị cho tiện)
                viewButton.addEventListener('click', async () => {
                    // toggle nếu đã load trước đó
                    if (loadedOnce && tongMonContainer.innerHTML && tongMonContainer.style.display !== 'none') {
                        tongMonContainer.style.display = 'none';
                        return;
                    }
                    tongMonContainer.style.display = 'block';

                    tongMonContainer.innerHTML = 'Đang tải danh sách tông môn...';
                    try {
                        const list = await fetchTongMonList();
                        renderList(list);
                        loadedOnce = true;
                    } catch (e) {
                        tongMonContainer.innerHTML = '';
                        notify(`Không tải được danh sách tông môn: ${e}`, 'error');
                    }
                });
            };

            setupTongMonSelectionSync({
                accountId,
                searchTongMonInput,
                tongMonContainer,
                viewButton: searchTongMonViewButton,
                fetchTongMonList: () => khoangmach.getListTongMon(),
                notify: showNotification
            });

            searchButton.addEventListener('click', async () => {
                searchButton.disabled = true;
                const originalText = 'Bắt đầu tìm kiếm';

                // 1️⃣ ĐỊNH NGHĨA HÀM CẬP NHẬT UI (Cái bộ đàm)
                // Hàm này nằm ngay trong scope của UI nên nó sửa được nút searchButton
                const updateBtn = (percent, msg) => {
                    // Giới hạn 0-100
                    percent = percent > 100 ? 100 : percent;
                    
                    // Cập nhật chữ
                    searchButton.textContent = `${percent}% - ${msg}`;
                    
                    // Cập nhật màu nền (Progress Bar Effect)
                    // Màu xanh (#2e7d32) chạy đè lên màu xám (#333)
                    searchButton.style.background = `linear-gradient(90deg, #2e7d32 ${percent}%, #333 ${percent}%)`;
                    searchButton.style.color = '#fff';
                };

                // Khởi tạo
                updateBtn(0, 'Đang chuẩn bị...');

                const rawEnemyIds = searchEnemiesInput.value;
                const enemyList = rawEnemyIds.split(';').map(id => id.trim()).filter(id => id); 
                const rawTongMonIds = searchTongMonInput.value;
                const tongMonList = rawTongMonIds.split(';').map(id => id.trim()).filter(id => id);

                try {
                    // 2️⃣ GỌI HÀM LOGIC VÀ TRUYỀN HÀM UI VÀO (Tham số thứ 3)
                    await khoangmach.searchEnemiesInMines(enemyList, tongMonList, updateBtn);

                    // Xử lý xong
                    updateBtn(100, 'Xong!');
                    await new Promise(r => setTimeout(r, 500)); // Đợi xíu cho đẹp

                } catch (err) {
                    console.error(err);
                    showNotification('Lỗi tìm kiếm', 'error');
                } finally {
                    // Reset nút về ban đầu
                    searchButton.disabled = false;
                    searchButton.textContent = originalText;
                    searchButton.style.background = ''; // Xóa gradient để về CSS mặc định
                    
                    // Enable nút xem kết quả nếu có
                    const hasData = sessionStorage.getItem(`khoangmach_enemy_search_results`);
                    if(hasData) viewResultsButton.disabled = false;
                }
            });

            viewResultsButton.addEventListener('click', () => {
                const searchResultSaved = sessionStorage.getItem('khoangmach_enemy_search_results');
                
                if (searchResultSaved) {
                    try {
                        const parsed = JSON.parse(searchResultSaved);

                        // Kiểm tra xem dữ liệu là định dạng MỚI (object) hay CŨ (array) để tránh lỗi
                        if (Array.isArray(parsed)) {
                            // Nếu lỡ là dữ liệu cũ (chỉ có mảng), ta fake tạm thời gian
                            khoangmach.showEnemySearchResults(parsed, Date.now(), 'Bộ nhớ tạm');
                        } else {
                            // Nếu là dữ liệu mới (có timestamp và source)
                            khoangmach.showEnemySearchResults(parsed.results, parsed.timestamp, parsed.source);
                        }
                    } catch (e) {
                        console.error('Lỗi đọc dữ liệu đã lưu:', e);
                        showNotification('Dữ liệu lưu bị lỗi.', 'error');
                    }
                } else {
                    showNotification('Chưa có kết quả tìm kiếm nào.', 'info');
                }
            });

            this.updateButtonState('khoangmach');

        }

        async createTienDuyenMenu(parentGroup) {
            const container = document.createElement('div');
            container.classList.add('custom-script-khoang-mach-container');
            parentGroup.appendChild(container);

            const buttonRow = document.createElement('div');
            buttonRow.classList.add('custom-script-khoang-mach-button-row');
            container.appendChild(buttonRow);

            const tienduyenButton = document.createElement('button');
            const settingButton = document.createElement('button');
            tienduyenButton.textContent = 'Tiên Duyên';
            tienduyenButton.classList.add('custom-script-khoang-mach-button');

            settingButton.textContent = '⚙️';
            settingButton.classList.add('custom-script-hoang-vuc-settings-btn');
            buttonRow.appendChild(settingButton);
            buttonRow.appendChild(tienduyenButton);

            const settingContainer = document.createElement('div');
            settingContainer.classList.add('custom-script-khoang-mach-container');
            settingContainer.style.display = 'none';
            container.appendChild(settingContainer);

            const inputRow = document.createElement('div');
            inputRow.classList.add('custom-script-khoang-mach-button-row');
            settingContainer.appendChild(inputRow);

            const input = document.createElement('input');
            input.type = 'text';
            input.value = '';
            input.classList.add('custom-script-menu-input');
            input.placeholder = "Nhập id người nhận hoa, ví dụ: 12345;23456;32456";
            input.style.flex = '1';
            inputRow.appendChild(input);

            const searchButton = document.createElement('button');
            searchButton.textContent = '🔍';
            searchButton.classList.add('custom-script-hoang-vuc-settings-btn');
            inputRow.appendChild(searchButton);
            settingContainer.appendChild(inputRow);

            // Xử lý sự kiện tìm kiếm id người nhận hoa

            tienduyenButton.addEventListener('click', async () => {
                    tienduyenButton.disabled = true;
                    tienduyenButton.textContent = 'Đang xử lý...';
                    try {
                        await tienduyen.tangHoa();
                    } finally {
                        tienduyenButton.textContent = 'Tiên Duyên';
                        this.updateButtonState('tienduyen');
                    }
            });

            // Ẩn/hiện inputRow
            settingButton.addEventListener('click', () => {
                settingContainer.style.display = settingContainer.style.display === 'none' ? 'flex' : 'none';
            });

            //Lưu input khi nhập
            input.addEventListener('input', () => {
                localStorage.setItem(`tienDuyenInputValue_${accountId}`, input.value);
            });

            /**
             * Hàm lấy danh sách id từ input
             * @return {Array<string>} Mảng id người nhận hoa: ['12345', '23456', ...]
             */
            const inputList = () => {
                return input.value.split(';').map(id => id.trim()).filter(id => id);
            };

            const friendContainer = document.createElement('div');
            friendContainer.classList.add('custom-script-khoang-mach-container');
            friendContainer.style.maxHeight = '300px';
            friendContainer.style.overflowY = 'auto';
            friendContainer.display = 'none';
            settingContainer.appendChild(friendContainer);

            //Chức năng cho searchButton
            searchButton.addEventListener('click', async () => {
                if (friendContainer.style.display === 'block') {
                    friendContainer.style.display = 'none';
                    return;
                }
                friendContainer.style.display = 'block';
                friendContainer.innerHTML = '';
                const friendList = await tienduyen.danhsachBanBe(); //Danh sách kiểu [{id: '12345', name: 'Tên bạn bè 1'}, {id: '67890', name: 'Tên bạn bè 2'}, ...]
                for (const friend of friendList) {
                    const friendDiv = document.createElement('div');
                    const friendLabel = document.createElement('label');
                    friendLabel.textContent = `${friend.name} (❤️${friend.thanMat})`;
                    const friendCheckbox = document.createElement('input');
                    friendCheckbox.type = 'checkbox';
                    friendCheckbox.checked = inputList().includes(friend.id) ? true : false;
                    friendCheckbox.addEventListener('change', () => {
                        let currentIds = inputList();
                        if (friendCheckbox.checked) {
                            // Thêm id vào input
                            if (!currentIds.includes(friend.id) && currentIds.length < 5) {
                                currentIds.push(friend.id);
                            } else {friendCheckbox.checked = false;
                                showNotification('Chỉ được chọn tối đa 5 người nhận hoa!', 'error');
                            }
                        } else {
                            // Xóa id khỏi input
                            currentIds = currentIds.filter(id => id !== friend.id);
                        }
                        input.value = currentIds.join(';');
                        localStorage.setItem(`tienDuyenInputValue_${accountId}`, input.value);
                    });
                    friendLabel.prepend(friendCheckbox);
                    friendDiv.appendChild(friendLabel);
                    friendContainer.appendChild(friendDiv);
                }
            });

            //Khởi tạo input khi load
            input.value = localStorage.getItem(`tienDuyenInputValue_${accountId}`) || '';

            // Lưu nút vào Map
            this.buttonMap.set('tienduyen', tienduyenButton);
            this.updateButtonState('tienduyen');

        }
        // Phương thức chung để tạo các nút nhiệm vụ tự động
        createAutoTaskButton(link, parentGroup) {
            const button = document.createElement('button');

            const taskName = link.isDiemDanh ? 'diemdanh' :
                             link.isThiLuyen ? 'thiluyen' :
                             link.isPhucLoi ? 'phucloi' : null;

            if (!taskName) return;

            // Lưu nút vào Map
            this.buttonMap.set(taskName, button);

            button.textContent = link.text;
            button.classList.add('custom-script-menu-button', 'custom-script-auto-btn');
            const originalColor = button.style.backgroundColor || '';
            const runningColor = '#ff0000ff';

            button.addEventListener('click', async () => {
                if (taskName === 'autorun') {
                    this.autorunIsRunning = !this.autorunIsRunning;

                    if (this.autorunIsRunning) {
                        await automatic.start();
                        button.style.backgroundColor = runningColor;
                    } else {
                        automatic.stop();
                        button.style.backgroundColor = originalColor;
                    }
                    this.updateButtonState('autorun');
                } else {
                    button.disabled = true;
                    button.textContent = 'Đang xử lý...';
                    try {
                        if (taskName === 'diemdanh') {
                            const nonce = await getNonce();
                            if (!nonce) {
                                showNotification('Không tìm thấy nonce! Vui lòng tải lại trang.', 'error');
                                return;
                            }
                            await doDailyCheckin(nonce);
                            await doClanDailyCheckin(nonce);
                            await vandap.doVanDap(nonce);
                            console.log('[HH3D Script] ✅ Điểm danh, tế lễ, vấn đáp đã hoàn thành.');
                        } else if (taskName === 'thiluyen') {
                            await doThiLuyenTongMon();
                            console.log('[HH3D Script] ✅ Thí Luyện Tông Môn đã hoàn thành.');
                        } else if (taskName === 'phucloi') {
                            await doPhucLoiDuong();
                            console.log('[HH3D Script] ✅ Phúc Lợi đã hoàn thành.');                        }
                    } finally {
                        button.textContent = link.text;
                        this.updateButtonState(taskName);
                    }
                 }
            });

        // Cập nhật trạng thái ban đầu của nút
        this.updateButtonState(taskName);
        parentGroup.appendChild(button);
        }

        // Đua top tông môn
        createDuaTopMenu(parentGroup) {
            const duaTopButton = document.createElement('button');
            duaTopButton.textContent = 'Đua Top TM';
            duaTopButton.classList.add('custom-script-menu-button', 'custom-script-auto-btn');
            duaTopButton.addEventListener('click', async () => {
                duaTopButton.disabled = true;
                duaTopButton.textContent = 'Đang xử lý...';
                try {
                    await doDuaTopTongMon();
                } finally {
                    duaTopButton.textContent = 'Đua Top TM';
                    duaTopButton.disabled = false;
                }
            });
            parentGroup.appendChild(duaTopButton);
        }
    }

    // ===============================================
    // Class khởi tạo và chèn menu vào DOM
    // ===============================================
    class UIInitializer {
        constructor(selector, linkGroups, accountId) {
            this.selector = selector;
            this.linkGroups = linkGroups;
            this.accountId = accountId;

            this.retryInterval = 500;
            this.timeout = 15000;
            this.elapsedTime = 0;
            this.intervalId = null;
            this.uiMenuCreator = new UIMenuCreator(null, this.accountId);
        }

        start() {
            console.log('[HH3D Script] ⏳ Đang tìm kiếm vị trí để chèn menu...');
            this.intervalId = setInterval(() => this.checkAndInsert(), this.retryInterval);
        }

        checkAndInsert() {
            const notificationsDiv = document.querySelector(this.selector);
            if (notificationsDiv) {
            clearInterval(this.intervalId);
            console.log('[HH3D Script] ✅ Đã tìm thấy vị trí. Bắt đầu chèn menu.');
            this.createAndInjectMenu(notificationsDiv);
            } else {
            this.elapsedTime += this.retryInterval;
            if (this.elapsedTime >= this.timeout) {
                clearInterval(this.intervalId);
                console.error(`[HH3D Script - Lỗi] ❌ Không tìm thấy phần tử "${this.selector}" sau ${this.timeout / 1000} giây.`);
            }
            }
        }

        createAndInjectMenu(notificationsDiv) {
            const parentNavItems = notificationsDiv.parentNode;
            if (parentNavItems && parentNavItems.classList.contains('nav-items')) {
            if (document.querySelector('.custom-script-item-wrapper')) {
                console.log('[HH3D Script] ⚠️ Menu đã tồn tại. Bỏ qua việc chèn lại.');
                return;
            }

            const customMenuWrapper = document.createElement('div');
            customMenuWrapper.classList.add('load-notification', 'relative', 'custom-script-item-wrapper');

            const newMenuButton = document.createElement('a');
            newMenuButton.href = '#';
            newMenuButton.setAttribute('data-view', 'hide');

            // Tạo phần tử div cho biểu tượng trạng thái
            const statusIcon = document.createElement('div');
            statusIcon.classList.add('custom-script-status-icon');
            //statusIcon.classList.add('material-icons-round1', 'material-icons-menu');
            newMenuButton.appendChild(statusIcon);



            const iconDiv = document.createElement('div');
            const iconSpan = document.createElement('span');
            iconSpan.classList.add('material-icons-round1', 'material-icons-menu');
            iconSpan.textContent = 'task';
            iconDiv.appendChild(iconSpan);
            newMenuButton.appendChild(iconDiv);

            const dropdownMenu = document.createElement('div');
            dropdownMenu.className = 'custom-script-menu hidden';

            this.linkGroups.forEach(group => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'custom-script-menu-group';
                dropdownMenu.appendChild(groupDiv);

                group.links.forEach(link => {
                if (link.isDiemDanh || link.isThiLuyen || link.isPhucLoi) {
                    this.uiMenuCreator.createAutoTaskButton(link, groupDiv);
                } else if (link.isDiceRoll) {
                    // Đổ Thạch
                    this.uiMenuCreator.createDiceRollMenu(groupDiv);
                } else if (link.isAutorun) {
                    // AUTORUN
                    this.uiMenuCreator.createAutorunMenu(groupDiv);
                } else if (link.isHoangVuc) {
                    // Hoang Vuc
                    this.uiMenuCreator.createHoangVucMenu(groupDiv);
                } else if (link.isLuanVo) {
                    // Luan Vo
                    this.uiMenuCreator.createLuanVoMenu(groupDiv);
                } else if (link.isBiCanh) {
                    // Bí Cảnh
                    this.uiMenuCreator.createBiCanhMenu(groupDiv);
                } else if (link.isKhoangMach) {
                    // Khoáng Mạch
                    this.uiMenuCreator.createKhoangMachMenu(groupDiv);
                } else if (link.isTienDuyen) {
                    // Tiên Duyên
                    this.uiMenuCreator.createTienDuyenMenu(groupDiv);
                } else if (link.isDuaTopTM) {
                    // Đua Top Tông Môn
                    this.uiMenuCreator.createDuaTopMenu(groupDiv);
                } else {
                    const menuItem = document.createElement('a');
                    menuItem.classList.add('custom-script-menu-link');
                    menuItem.href = link.url;
                    menuItem.textContent = link.text;
                    menuItem.target = '_blank';
                    groupDiv.appendChild(menuItem);
                }
                });
            });

            // --- THÊM DÒNG NÀY ĐỂ TẠO THANH TRẠNG THÁI ---
            const statusBar = document.createElement('div');
            statusBar.className = 'custom-script-status-bar';
            dropdownMenu.appendChild(statusBar);
            // ---------------------------------------------
            customMenuWrapper.appendChild(newMenuButton);
            customMenuWrapper.appendChild(dropdownMenu);
            parentNavItems.insertBefore(customMenuWrapper, notificationsDiv.nextSibling);







            console.log('[HH3D Script] 🎉 Chèn menu tùy chỉnh thành công!');

            newMenuButton.addEventListener('click', (e) => {
                e.preventDefault();
                dropdownMenu.classList.toggle('hidden');
                iconSpan.textContent = dropdownMenu.classList.contains('hidden') ? 'task' : 'highlight_off';
            });

            document.addEventListener('click', (e) => {
                if (!customMenuWrapper.contains(e.target)) {
                dropdownMenu.classList.add('hidden');
                iconSpan.textContent = 'task';
                }
            });
            } else {
            console.warn('[HH3D Script - Cảnh báo] ⚠️ Không tìm thấy phần tử cha ".nav-items". Không thể chèn menu.');
            }
        };


        // Hàm để cập nhật statusbar
        updateStatusBar(message, type = 'info', duration = null) {
            const statusBar = document.querySelector('.custom-script-status-bar');
            if (!statusBar) return;

            const messageElement = document.createElement('div');
            messageElement.className = 'custom-script-message';
            messageElement.classList.add(type);
            messageElement.textContent = message;

            // Thêm thông báo vào cuối danh sách
            statusBar.appendChild(messageElement);

            // Xóa thông báo cũ nếu quá nhiều để tránh tràn màn hình
            while (statusBar.children.length > 5) { // Giới hạn 5 thông báo
                statusBar.removeChild(statusBar.firstChild);
            }

            // Tự động xóa thông báo sau một khoảng thời gian
            if (duration !== null) {
                setTimeout(() => {
                    messageElement.style.animation = 'fadeOut 0.3s forwards';
                    messageElement.addEventListener('animationend', () => {
                        if (messageElement.parentNode === statusBar) {
                            statusBar.removeChild(messageElement);
                        }
                    });
                }, duration);
            }
        }

        // Hàm mới để xóa tất cả thông báo
        clearStatusBar() {
            const statusBar = document.querySelector('.custom-script-status-bar');
            if (statusBar) {
                while (statusBar.firstChild) {
                    statusBar.removeChild(statusBar.firstChild);
                }
            }
        }

        // Hàm gọi phương thức updateButtonState của UIMenuCreator
        async updateButtonState(taskName) {
            await this.uiMenuCreator.updateButtonState(taskName);
        }
    }


    // ===============================================
    // Automactic
    // ===============================================
    class AutomationManager {
        constructor() {
            this.accountId = accountId;
            this.delay = 5000;
            this.CHECK_INTERVAL_TIEN_DUYEN = 30*60*1000;
            this.INTERVAL_HOANG_VUC = 15*60*1000 + this.delay;
            this.INTERVAL_PHUC_LOI = 30*60*1000 + this.delay;
            this.INTERVAL_THI_LUYEN = 30*60*1000 + this.delay;
            this.INTERVAL_BI_CANH = 7*60*1000 + this.delay;
            this.INTERVAL_KHOANG_MACH = localStorage.getItem('khoangmach_check_interval') ? parseInt(localStorage.getItem('khoangmach_check_interval'))*60*1000 + this.delay : 5*60*1000 + this.delay;
            this.INTERVAL_HOAT_DONG_NGAY = 10*60*1000 + this.delay;
            this.timeoutIds = {};
            this.isRunning = false;
        }

        async start() {
            console.log(`[Auto] Bắt đầu quá trình tự động cho tài khoản: ${this.accountId}`);
            this.isRunning = true;
            // Thực hiện các tác vụ ban đầu

            const autoDiemDanh = localStorage.getItem('autoDiemDanh') !== '0';
            const autoTienDuyen = localStorage.getItem('autoTienDuyen') !== '0';
            const autoThiLuyen = localStorage.getItem('autoThiLuyen') !== '0';
            const autoPhucLoi = localStorage.getItem('autoPhucLoi') !== '0';
            const autoHoangVuc = localStorage.getItem('autoHoangVuc') !== '0';
            const autoBiCanh = localStorage.getItem('autoBiCanh') !== '0';
            const autoLuanVo = localStorage.getItem('autoLuanVo') !== '0';
            const autoDoThach = localStorage.getItem('autoDoThach') !== '0';
            const autoKhoangMach = localStorage.getItem('autoKhoangMach') !== '0';

            if (autoDiemDanh) {
            await this.doInitialTasks();
            }
            // Bắt đầu chu kỳ hẹn giờ cho Tiên Duyên
            if (autoTienDuyen) {
                await this.scheduleTienDuyenCheck()
            }
            // Đổ thạch
            if (autoDoThach) {
                await this.scheduleDoThach()
            }
            // Lên lịch các tác vụ định kỳ
            if (autoHoangVuc) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.scheduleTask('hoangvuc', () => hoangvuc.doHoangVuc(), this.INTERVAL_HOANG_VUC);
            }
            if (autoThiLuyen) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.scheduleTask('thiluyen', () => doThiLuyenTongMon(), this.INTERVAL_THI_LUYEN);
            }
            if (autoPhucLoi) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.scheduleTask('phucloi', () => doPhucLoiDuong(), this.INTERVAL_PHUC_LOI);
            }
            if (autoKhoangMach) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.INTERVAL_KHOANG_MACH = localStorage.getItem('khoangmach_check_interval') ? parseInt(localStorage.getItem('khoangmach_check_interval'))*60*1000 + this.delay : 5*60*1000 + this.delay;
                await this.scheduleTask('khoangmach', () => khoangmach.doKhoangMach(), this.INTERVAL_KHOANG_MACH);
            }
            if (autoBiCanh) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.scheduleTask('bicanh', () => bicanh.doBiCanh(), this.INTERVAL_BI_CANH);
            }
            if (autoLuanVo) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                await this.scheduleLuanVo();
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.scheduleHoatDongNgay();
            this.selfSchedule();
            this.applyPromoCode();
        }

        async eventSchedule() {
            const now = Date.now();
            const nextEventTime = taskTracker.getNextTime(accountId, 'event');
            
            // Logic tính thời gian chờ mặc định
            // Nếu chưa có lịch hoặc tính ra số âm (quá khứ) thì đợi 1s rồi check lại, ngược lại đợi đúng thời gian
            let waitTime = 1000; 

            if (nextEventTime && now >= nextEventTime) {
                console.log("[Auto] ⏰ Đã đến giờ sự kiện. Đang thực hiện...");
                try {
                    // Thực hiện nhiệm vụ
                    await doDuaTopTongMon();
                    
                    // QUAN TRỌNG: Hàm doDuaTopTongMon phải có lệnh cập nhật lại nextEventTime (taskTracker.adjustTaskTime)
                    // Nếu không cập nhật thời gian, nó sẽ lặp vô tận liên tục gây treo trình duyệt.
                } catch (error) {
                    console.error("[Auto] ❌ Lỗi khi thực hiện sự kiện:", error);
                }
                
                // Sau khi chạy xong (dù lỗi hay không), đợi 5 giây rồi check lại lịch mới
                waitTime = 5000; 
            } else {
                // Chưa đến giờ, tính thời gian chờ
                if (nextEventTime) {
                    waitTime = nextEventTime - now;
                    // Đảm bảo không chờ số âm (nếu máy tính bị lag)
                    if (waitTime < 0) waitTime = 1000; 
                } else {
                    // Nếu không tìm thấy lịch (null), mặc định check lại sau 5 phút
                    waitTime = 5 * 60 * 1000; 
                }

            }
            // Gọi đệ quy để duy trì vòng lặp vĩnh viễn
            setTimeout(() => {
                this.eventSchedule();
            }, waitTime + (this.delay || 0));
        }

        // Tự nhập mã thưởng
        async applyPromoCode() {
            const promoCodeSaved = localStorage.getItem(`promo_code_${accountId}`) || '';

            const fetchPromoCode = async () => {
                try {
                    const response = await fetch('https://raw.githubusercontent.com/syntaxerr0r/Vuong_Ma_Tu/refs/heads/main/code');
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const text = await response.text();
                    return text.trim();
                } catch (error) {
                    console.error('[Auto] Lỗi khi lấy mã thưởng từ GitHub:', error);
                    return null;
                }
            };

            const promoCodeFetched = await fetchPromoCode();
            if (!promoCodeFetched || promoCodeSaved === promoCodeFetched) {
                console.log('[Auto] Mã thưởng không thay đổi hoặc không lấy được');
                return;
            }

            try {
                // Lấy nonce từ trang linh thạch
                const nonce = await getSecurityNonce(weburl + 'linh-thach?t', /['"]action['"]\s*:\s*['"]redeem_linh_thach['"][\s\S]*?['"]nonce['"]\s*:\s*['"]([a-f0-9]+)['"]/i);

                if (!nonce) {
                    console.error('[Auto] Không thể lấy nonce cho việc nhập mã thưởng');
                    return;
                }

                console.log(`[Auto] Đang nhập mã thưởng: ${promoCodeFetched}`);

                const response = await fetch(ajaxUrl, {
                    credentials: "include",
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0",
                        "Accept": "*/*",
                        "Accept-Language": "vi,en-US;q=0.5",
                        "Content-Type": "application/x-www-form-urlencoded",
                        "X-Requested-With": "XMLHttpRequest",
                        "Sec-Fetch-Dest": "empty",
                        "Sec-Fetch-Mode": "cors",
                        "Sec-Fetch-Site": "same-origin",
                        "Priority": "u=0"
                    },
                    body: `action=redeem_linh_thach&code=${encodeURIComponent(promoCodeFetched)}&nonce=${nonce}&hold_timestamp=${Math.floor(Date.now()/1000)}`,
                    method: "POST",
                    mode: "cors"
                });

                const data = await response.json();

                if (data.success) {
                    showNotification(data.data.message, 'success');
                    localStorage.setItem(`promo_code_${accountId}`, promoCodeFetched);
                } else if (data.data.message  === '⚠️ Đạo hữu đã hấp thụ linh thạch này rồi!') {
                    localStorage.setItem(`promo_code_${accountId}`, promoCodeFetched);
                } else {
                    showNotification(`❌ Lỗi nhập mã thưởng: ${data.message || 'Không xác định'}`, 'error');
                }

            } catch (error) {
                console.error('[Auto] Lỗi khi nhập mã thưởng:', error);
                showNotification(`❌ Lỗi khi nhập mã thưởng: ${error.message}`, 'error');
            }
        }

        /**Lên lịch tự chạy lại vào lúc 1 giờ */
        async selfSchedule() {
            if (!this.isRunning) return;
            const now = Date.now();
            const timeToRerun = new Date();
            timeToRerun.setHours(1, 0, 0, 0);
            if (timeToRerun.getTime() <= now) {
                timeToRerun.setDate(timeToRerun.getDate() + 1);
            }
            const delay = timeToRerun.getTime() - now;
            console.log(`[Auto] Lên lịch tự chạy lại vào lúc 1 giờ sáng. Thời gian chờ: ${delay}ms.`);
            setTimeout(() => {
                this.stop();
            }, delay);
            setTimeout(() => {
                this.start();
            }, delay+1000);

        }

        async doInitialTasks() {
            if (!taskTracker.isTaskDone(this.accountId, 'diemdanh')) {
                try {
                    const nonce = await getNonce()
                    if (!nonce) return
                    await doDailyCheckin(nonce);
                    await doClanDailyCheckin(nonce);
                    await vandap.doVanDap(nonce);
                    createUI.updateButtonState('diemdanh')
                } catch (e) {
                    console.error("[Auto] Lỗi khi thực hiện Điểm danh, tế lễ, vấn đáp:", e);
                }
            } else {
                createUI.updateButtonState('diemdanh')
            }
        }

        async scheduleTienDuyenCheck() {
            const now = Date.now();
            const lastCheckTienDuyen = taskTracker.getLastCheckTienDuyen(this.accountId);
            let timeToNextCheck;

            if (lastCheckTienDuyen === null || now - lastCheckTienDuyen >= this.CHECK_INTERVAL_TIEN_DUYEN) {
                console.log("[Auto] Đã đến giờ làm Tiên Duyên. Đang thực hiện...");
                try {
                    await tienduyen.doTienDuyen();
                } catch (error) {
                    console.error("[Auto] Lỗi khi thực hiện Tiên Duyên:", error);
                }
                timeToNextCheck = this.CHECK_INTERVAL_TIEN_DUYEN;
            } else {
                timeToNextCheck = this.CHECK_INTERVAL_TIEN_DUYEN - (now - lastCheckTienDuyen);
                console.log(`[Auto] Chưa đến giờ tiên duyên. Sẽ chờ ${timeToNextCheck}ms.`);
            }

            // Hẹn giờ gọi lại chính nó sau khoảng thời gian đã tính
            if (this.tienduyenTimeout) clearTimeout(this.tienduyenTimeout);
            this.tienduyenTimeout = setTimeout(() => this.scheduleTienDuyenCheck(), timeToNextCheck);
        }


        /**
         * Tạo lịch trình cho một nhiệm vụ cụ thể.
         - Ví dụ: scheduleTask('thiluyen', () => thiluyen.doThiLuyen(), this.INTERVAL_THI_LUYEN, 'thiluyenTimeout')
         * @param {string} taskName Tên của nhiệm vụ, dùng để truy vấn trạng thái (ví dụ: 'thiluyen').
         * @param {Function} taskAction Hàm bất đồng bộ thực thi nhiệm vụ (ví dụ: `hoangvuc.doHoangVuc`).
         * @param {number} interval Chu kỳ lặp lại của nhiệm vụ tính bằng mili giây.
         */
        async scheduleTask(taskName, taskAction, interval) {
            if (this.timeoutIds[taskName]) clearTimeout(this.timeoutIds[taskName]);
            let isTaskDone;
            if (taskName === 'bicanh' && await bicanh.isDailyLimit()) {
                isTaskDone = true;
            } else {
                isTaskDone = taskTracker.isTaskDone(this.accountId, taskName);
            }
            // Kiểm tra và dừng lịch trình nếu nhiệm vụ đã hoàn thành
            if (isTaskDone) {
                createUI.updateButtonState(taskName);
                return;
            }

            const now = Date.now();
            const nextTime = taskTracker.getNextTime(this.accountId, taskName);
            let timeToNextCheck;

            if (nextTime === null || now >= nextTime) {
                console.log(`[Auto] Đã đến giờ làm nhiệm vụ: ${taskName}. Đang thực hiện...`);
                try {
                    await taskAction(); // Thực thi hàm nhiệm vụ
                    timeToNextCheck = interval;
                    createUI.updateButtonState(taskName);
                } catch (error) {
                    console.error(`[Auto] Lỗi khi thực hiện nhiệm vụ ${taskName}:`, error);
                    // Có thể đặt thời gian chờ ngắn hơn khi có lỗi để thử lại
                    timeToNextCheck = 3*60 * 1000; // Thử lại sau 3 phút
                }
            } else {
                createUI.updateButtonState(taskName);
                timeToNextCheck = Math.max(nextTime - now, 0);
                console.log(`[Auto] Nhiệm vụ ${taskName} chưa đến giờ, sẽ chờ ${timeToNextCheck}ms.`);
            }

            // Hẹn giờ cho lần chạy tiếp theo
            if (this.timeoutIds[taskName]) clearTimeout(this.timeoutIds[taskName]);
            if (!taskTracker.isTaskDone(accountId,taskName)) {
                const taskFullName = {
                    hoangvuc: "Hoang Vực",
                    phucloi: "Phúc Lợi",
                    thiluyen: "Thí Luyện",
                    bicanh: "Bí Cảnh",
                    khoangmach: "Khoáng Mạch"
                }[taskName];
                //showNotification(
                createUI.updateStatusBar(
                    `🕐 ${taskFullName}: ${new Date(Date.now() + timeToNextCheck).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
                    'info',
                    timeToNextCheck
                );
                this.timeoutIds[taskName] = setTimeout(() => this.scheduleTask(taskName, taskAction, interval), timeToNextCheck);
            }
        }


        async scheduleLuanVo() {
            const isDone = taskTracker.isTaskDone(this.accountId, 'luanvo');
            if (isDone) {
                if (this.luanvoTimeout) clearTimeout(this.luanvoTimeout);
                return;
            }
            const nonce = await getNonce();
            if (!nonce) {
                showNotification(' Lỗi: Không thể❌ lấy nonce cho Luận Võ.', 'error');
                return;
            }
            await luanvo.startLuanVo(nonce);
            let timeTo21h = new Date();
            timeTo21h.setHours(21, 1, 0, 0);
            const delay = timeTo21h.getTime() - Date.now();
            console.log(`[Auto] Lên lịch Luận Võ vào lúc 00:01. Thời gian chờ: ${delay}ms.`);
            if (this.luanvoTimeout) clearTimeout(this.luanvoTimeout);
            if (delay < 0) {
                await luanvo.thueTieuViem();
                await luanvo.doLuanVo(true);
            } else {
                this.luanvoTimeout = setTimeout(() => this.scheduleLuanVo(), delay);
            }
        }


        async scheduleDoThach() {
            const status = taskTracker.getTaskStatus(accountId, 'dothach');
                const isBetPlaced = status.betplaced;
                const isRewardClaimed = status.reward_claimed;

                const currentHour = parseInt(
                    new Date().toLocaleString('en-US', {
                        timeZone: 'Asia/Ho_Chi_Minh',
                        hour: 'numeric',
                        hour12: false
                    }),
                    10
                );

                let nextActionTime; // Giờ hành động tiếp theo (ví dụ: 13, 16, 21, 6)
                let timeToNextCheck; // Thời gian chờ (mili giây)

                const calculateTimeToNextHour = (targetHour) => {
                    const now = new Date();
                    const nextTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, 0, 0, 0);
                    if (now.getHours() >= targetHour) {
                        nextTime.setDate(nextTime.getDate() + 1); // Nếu giờ mục tiêu đã qua, chuyển sang ngày mai
                    }
                    return nextTime.getTime() - now.getTime();
                };

                if (isBetPlaced) {
                    // Đã đặt cược, chờ đến giờ nhận thưởng
                    if (currentHour >= 6 && currentHour < 13) {
                        nextActionTime = 13; // Chờ đến 13h để nhận thưởng lần 1
                    } else if (currentHour >= 16 && currentHour < 21) {
                        nextActionTime = 21; // Chờ đến 21h để nhận thưởng lần 2
                    } else {
                        console.log('[Đổ Thạch] Đã đặt cược nhưng không trong khung giờ cược, chờ khung giờ nhận thưởng tiếp theo.');
                        if (currentHour < 13) {
                            nextActionTime = 13;
                        } else if (currentHour < 21) {
                            nextActionTime = 21;
                        } else {
                            nextActionTime = 6; // Chờ đến 6h sáng mai
                        }
                    }
                } else if (isRewardClaimed) {
                    // Đã nhận thưởng, chờ đến giờ đặt cược tiếp theo
                    if (currentHour >= 13 && currentHour < 16) {
                        nextActionTime = 16; // Chờ đến 16h để đặt cược lần 2
                    } else {
                        nextActionTime = 6; // Chờ đến 6h sáng hôm sau
                    }
                } else {
                    const stoneType = localStorage.getItem('dice-roll-choice') ?? 'tai';
                    // Chưa đặt cược hoặc chưa nhận thưởng. Cần kiểm tra khung giờ hiện tại
                    if (currentHour >= 6 && currentHour < 13) {
                        console.log('[Đổ Thạch] Đang trong khung giờ 6h-13h. Đang đặt cược...');
                        await dothach.run(stoneType); // Thực hiện đặt cược
                        nextActionTime = 13; // Sau khi cược, chờ đến 13h để kiểm tra thưởng
                    } else if (currentHour >= 16 && currentHour < 21) {
                        console.log('[Đổ Thạch] Đang trong khung giờ 16h-21h. Đang đặt cược...');
                        await dothach.run(stoneType); // Thực hiện đặt cược
                        nextActionTime = 21; // Sau khi cược, chờ đến 21h để kiểm tra thưởng
                    } else {
                        // Không trong khung giờ nào, chờ đến khung giờ đặt cược tiếp theo
                        console.log('[Đổ Thạch] Không trong khung giờ cược. Chờ...');
                        if (currentHour < 6) {
                            nextActionTime = 6;
                        } else if (currentHour < 16) {
                            nextActionTime = 16;
                        } else {
                            nextActionTime = 6; // Chờ đến 6h sáng mai
                        }
                    }
                }

                timeToNextCheck = calculateTimeToNextHour(nextActionTime);

                // Hủy timeout cũ nếu có và thiết lập timeout mới
                if (this.dothachTimeout) clearTimeout(this.dothachTimeout);
                this.dothachTimeout = setTimeout(() => this.scheduleDoThach(), timeToNextCheck);

                console.log(`[Đổ Thạch] Lần kiểm tra tiếp theo lúc: ${new Date(Date.now() + timeToNextCheck).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
            }

        async scheduleHoatDongNgay() {
            const isDone = taskTracker.isTaskDone(this.accountId, 'hoatdongngay');
            if (isDone) {
                if (this.hoatdongngayTimeout) clearTimeout(this.hoatdongngayTimeout);
                return;
            }
            const isHoangVucDone = taskTracker.isTaskDone(this.accountId, 'hoangvuc');
            const isPhucLoiDone = taskTracker.isTaskDone(this.accountId, 'phucloi');
            const isDiemDanhDone = taskTracker.isTaskDone(this.accountId, 'diemdanh');
            const isLuanVoDone = taskTracker.isTaskDone(this.accountId, 'luanvo');
            if (isHoangVucDone && isPhucLoiDone && isDiemDanhDone && isLuanVoDone) {
                try {
                    await hoatdongngay.doHoatDongNgay();
                    if (this.hoatdongngayTimeout) clearTimeout(this.hoatdongngayTimeout);
                    if (taskTracker.isTaskDone(this.accountId, 'hoatdongngay') && this.hoatdongngayTimeout) {
                        return;
                    } else {
                        this.hoatdongngayTimeout = setTimeout(() => this.scheduleHoatDongNgay(), 5*60*1000);
                    }
                }
                catch (e) {
                    console.error("[Auto] Lỗi khi thực hiện Hoạt Động Ngày:", e);
                }
            } else {
                if (this.hoatdongngayTimeout) clearTimeout(this.hoatdongngayTimeout);
                this.hoatdongngayTimeout = setTimeout(() => this.scheduleHoatDongNgay(), this.INTERVAL_HOAT_DONG_NGAY);
            }
        }

        stop() {
            if (!this.isRunning) return;
            for (const taskName in this.timeoutIds) {
                if (this.timeoutIds[taskName]) {
                    clearTimeout(this.timeoutIds[taskName]);
                    this.timeoutIds[taskName] = null; // Đặt lại giá trị để tránh rò rỉ bộ nhớ
                    console.log(`[Auto] Đã hủy hẹn giờ cho nhiệm vụ: ${taskName}`);
                }
            }
            if (this.tienduyenTimeout) {
                clearTimeout(this.tienduyenTimeout);
                console.log(`Đã dừng quá trình tự động tiên duyên`);
            }
            if (this.dothachTimeout) {
                clearTimeout(this.dothachTimeout);
                console.log(`Đã dừng quá trình tự động đổ thạch`);
            }
            if (this.hoatdongngayTimeout) {
                clearTimeout(this.hoatdongngayTimeout);
                console.log(`Đã dừng quá trình tự động hoạt động ngày`);
            }
            createUI.clearStatusBar();
        }

        checkAndStart() {
            if (localStorage.getItem('autorunEnabled') === null) {
                localStorage.setItem('autorunEnabled', '0');
            }

            let autorunEnabled = localStorage.getItem('autorunEnabled') === '1';

            if (autorunEnabled) {
                console.log('[Automation] Tự động khởi động Autorun...');

                // Tạo một hàm chờ để đảm bảo UI đã sẵn sàng
                const checkStatusIcon = () => {
                    const statusIcon = document.querySelector('.custom-script-status-icon');
                    if (statusIcon) {
                        // Nếu icon đã tồn tại, cập nhật trạng thái và bắt đầu tác vụ
                        createUI.uiMenuCreator.setAutorunIsRunning();
                        createUI.uiMenuCreator.updateButtonState('autorun');
                        this.start();
                    } else {
                        // Nếu icon chưa tồn tại, chờ 100ms và thử lại
                        setTimeout(checkStatusIcon, 100);
                    }
                };

                // Bắt đầu quá trình kiểm tra
                checkStatusIcon();
            }
        }
    }

    // ===============================================
    // HIỆN TU VI KHOÁNG MẠCH
    // ===============================================
    class hienTuviKhoangMach {
        constructor() {
            this.selfTuViCache = null;
            this.mineImageSelector = '.mine-image';
            this.attackButtonSelector = '.attack-btn';
            this.currentMineUsers = []; // Sẽ lưu dữ liệu người dùng tại đây
            this.tempObserver = null; // Biến để lưu MutationObserver tạm thời
            this.nonceGetUserInMine = null;
            this.nonce = null;
            this.headers = {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest'
            };
            this.currentMineId = null;
            this.tempObserverRearrange = null; // Biến để lưu MutationObserver tạm thời khi sắp xếp

        }

        async waitForElement(selector, timeout = 15000) {
            const found = document.querySelector(selector);
            if (found) return Promise.resolve(found);
            return new Promise((resolve) => {
                const obs = new MutationObserver(() => {
                    const el = document.querySelector(selector);
                    if (el) {
                        obs.disconnect();
                        clearTimeout(timer);
                        resolve(el);
                    }
                });
                obs.observe(document.documentElement || document.body, { childList: true, subtree: true });
                const timer = setTimeout(() => {
                    obs.disconnect();
                    resolve(null);
                }, timeout);
            });
        }
        async getNonceGetUserInMine() {
            const htmlSource = document.documentElement.innerHTML;
            const regex = /action:\s*'get_users_in_mine',[\s\S]*?security:\s*'([a-f0-9]+)'/;
            const match = htmlSource.match(regex);
            return match ? match[1] : null;
        }

        async getNonce() {
            if (typeof customRestNonce !== 'undefined' && customRestNonce) {
                return customRestNonce;
            }
            const scripts = document.querySelectorAll('script');
            for (const script of scripts) {
                const match = script.innerHTML.match(/customRestNonce\s*=\s*'([a-f0-9]+)'/);
                if (match) return match[1];
            }
            try {
                const html = await fetch(weburl + '?t').then(r => r.text());
                return html.match(/customRestNonce\s*=\s*'([a-f0-9]+)'/)?.[1] ?? null;
            } catch { return null; }
        }

        async getSelfTuVi() {
            if (this.selfTuViCache !== null) {
                return this.selfTuViCache;
            }
            const el = document.querySelector('#head_manage_acc');
            const text = el?.textContent || "";
            const num = text.match(/\d+/);
            if (num) {
                this.selfTuViCache = parseInt(num[0]);
                return this.selfTuViCache;
            }
            return null;
        }

        async getProfileTier(userId) {
            if (!userId) return null;
            try {
                const res = await fetch(`${weburl}profile/${userId}/`);
                if (!res.ok) return null;

                const text = await res.text(); // phải await
                const doc = new DOMParser().parseFromString(text, 'text/html');

                const h4 = doc.querySelector('h4');
                if (!h4) return null;

                // lấy text từ <b> nếu có, nếu không fallback div/h4
                const raw = h4.querySelector('b')?.textContent
                        || h4.querySelector('div')?.textContent
                        || h4.textContent
                        || "";

                return raw.trim();
            } catch (e) {
                console.error(`${this.logPrefix} ❌ Lỗi mạng (lấy cảnh giới):`, e);
                return null;
            }
        }

        winRate(selfTuVi, opponentTuVi) {
            if (!selfTuVi || !opponentTuVi) return -1;
            if (typeof selfTuVi !== 'number' || typeof opponentTuVi !== 'number') return -1;
            if (selfTuVi <= 0 || opponentTuVi <= 0) return -1;
            if (selfTuVi >= 10 * opponentTuVi) return 100;
            if (opponentTuVi >= 10 * selfTuVi) return 0;
            let winChance = 50;
            const diff = selfTuVi - opponentTuVi;
            const ratio = diff > 0 ? selfTuVi / opponentTuVi : opponentTuVi / selfTuVi;
            const factor = ratio >= 8 ? 1 : ratio >= 7 ? 0.9 : ratio >= 6 ? 0.8 :
                ratio >= 5 ? 0.7 : ratio >= 4 ? 0.6 : ratio >= 3 ? 0.5 :
                ratio >= 2 ? 0.4 : 0.3;
            winChance += (diff / 1000) * factor;
            return Math.max(0, Math.min(100, winChance));
        }

        async upsertTuViInfo(btn, userId, opponentTuVi, myTuVi) {
            const cls = 'hh3d-tuvi-info';
            const next = btn.nextElementSibling;
            const opponentTuViText = typeof opponentTuVi === 'number' ? opponentTuVi : 'Unknown';

            // Tạo nội dung HTML một lần duy nhất
            const rate = this.winRate(myTuVi, opponentTuVi).toFixed(2);
            const rateNumber = parseFloat(rate);
            let rateColor;
            if (rateNumber === -1) {
                rateColor = '#808080'; // Grey
            }
                else if (rateNumber < 25) {
                rateColor = '#ff5f5f'; // Red
            } else if (rateNumber > 75) {
                rateColor = '#00ff00'; // Green
            } else {
                rateColor = '#ffff00ff'; // White
            }

            let displayRate = rate;
            if (rateNumber === 0.00) {
                displayRate = '0';
            } else if (rateNumber === 100.00) {
                displayRate = '100';
            } else if (rateNumber === -1) {
                displayRate = 'Không rõ';
            }
            let innerHTMLContent = '';
            if (myTuVi <= 10 * opponentTuVi) {
            innerHTMLContent = `
                <p><strong>Tu Vi:</strong> <span style="font-weight: bold; color: #ffff00ff;">${opponentTuViText}</span></p>
                <p><strong>Tỷ Lệ Thắng:</strong> <span style="font-weight: bold; color: ${rateColor};">${displayRate}%</span></p>
            `;
            } else {
            innerHTMLContent = `
                <p><strong>Tu Vi:</strong> <span style="font-weight: bold; color: #ffff00ff;">${opponentTuViText}</span></p>
                <p><span style="font-weight: bold; color: #00ff00ff;">Không tốn lượt</span></p>
            `;
            }

            if (next && next.classList.contains(cls) && next.dataset.userId === String(userId)) {
                next.innerHTML = innerHTMLContent;
                return;
            }

            document.querySelectorAll(`.${cls}[data-user-id="${userId}"]`).forEach(el => {
                if (el !== next) el.remove();
            });

            const info = document.createElement('div');
            info.className = cls;
            info.dataset.userId = String(userId);
            info.style.fontSize = '12px';
            info.style.color = '#fff';
            info.style.marginTop = '3px';
            info.style.backgroundColor = 'none';
            info.style.padding = '0px 0px';
            info.style.border = 'none';

            // Sử dụng biến đã tạo ở trên
            info.innerHTML = innerHTMLContent;

            btn.insertAdjacentElement('afterend', info);
        }

        async upsertTierInfo(btn, userId) {
            const cls = 'hh3d-tuvi-info';
            const next = btn.nextElementSibling;
            const tierText = await this.getProfileTier(userId);
            console.log(`UserID: ${userId}, Tier: ${tierText}`);
            if (!tierText) return;
            if (next && next.classList.contains(cls) && next.dataset.userId === String(userId)) {
                next.innerHTML = `<p><strong>Cảnh giới:</strong> <span style="font-weight: bold; color: #ffff00ff;">${tierText}</span></p>`;
                return;
            }

            document.querySelectorAll(`.${cls}[data-user-id="${userId}"]`).forEach(el => {
                if (el !== next) el.remove();
            });
            const info = document.createElement('div');
            info.className = cls;
            info.dataset.userId = String(userId);
            info.style.fontSize = '12px';
            info.style.color = '#fff';
            info.style.marginTop = '3px';
            info.style.backgroundColor = 'none';
            info.style.padding = '0px 0px';
            info.style.border = 'none';
            info.innerHTML = `<p><strong>Cảnh giới:</strong> <span style="font-weight: bold; color: #ffff00ff;">${tierText}</span></p>`;
            btn.insertAdjacentElement('afterend', info);
        }

        async getUsersInMine(mineId) {
            let securityToken = null;
            // Cách 1: Lấy từ unsafeWindow (Biến thật của trang web)
            if (typeof hh3dData !== 'undefined' && hh3dData.securityToken) {
                console.log(`[Hiện Tu vi] ℹ️ Lấy 'security_token' từ biến global thông thường.`);
                securityToken = hh3dData.securityToken;
            } else // Cách 2: Lấy từ unsafeWindow (Biến của trang web trong môi trường userscript)
                if (typeof unsafeWindow !== 'undefined' && unsafeWindow.hh3dData && unsafeWindow.hh3dData.securityToken) {
                console.log(`[Hiện Tu vi] ℹ️ Lấy 'security_token' từ unsafeWindow.`);
                securityToken = unsafeWindow.hh3dData.securityToken;
            } 

            if (!this.nonceGetUserInMine || !securityToken) {
                let errorMsg = 'Lỗi (get_users):';
                if (!this.nonceGetUserInMine) errorMsg += " Nonce (security) chưa được cung cấp.";
                if (!securityToken) errorMsg += " Không tìm thấy 'security_token' (hh3dData).";

                showNotification(errorMsg, 'error');
                return null;
            }

            const payload = new URLSearchParams({
                action: 'get_users_in_mine',
                mine_id: mineId,
                security_token: securityToken,
                security: this.nonceGetUserInMine
            });

            try {
                const r = await fetch(ajaxUrl, {
                    method: 'POST',
                    headers: this.headers,
                    body: payload,
                    credentials: 'include'
                });
                const d = await r.json();

                return d.success ? d.data : (showNotification(d.message || 'Lỗi lấy thông tin người chơi.', 'error'), null);

            } catch (e) {
                console.error(`[Hiện Tu vi] ❌ Lỗi mạng (lấy user):`, e);
                return null;
            }
        }

        async getTuVi(userId) {
            // 0. Chuẩn bị Nonce & Headers
            if (!this.nonce) {
                this.nonce = await this.getNonce();
            }
            const nonce = this.nonce;
            if (!nonce) return null;

            const headers = {
                "Content-Type": "application/json",
                "X-WP-Nonce": nonce
            };
            const targetId = String(userId);

            // ============================================================
            // 🟢 CÁCH 1: LOGIC CŨ (SEARCH TRỰC TIẾP)
            // ============================================================
            try {
                const res = await fetch(`${weburl}/wp-json/luan-vo/v1/search-users`, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify({ query: targetId, page: 1 }),
                    credentials: "include",
                    mode: "cors"
                });

                // Logic gốc: Lấy user đầu tiên trong danh sách (users[0])
                const points = res.ok ? (await res.json())?.data?.users?.[0]?.points ?? null : null;

                // Nếu tìm thấy điểm -> Trả về luôn
                if (points !== null && points !== undefined) {
                    return points;
                }
            } catch (e) {
                // Lỗi ở cách 1 -> Bỏ qua để chạy xuống cách 2
            }

            // ============================================================
            // 🔴 CÁCH 2: FALLBACK (FOLLOW -> SCAN -> UNFOLLOW)
            // ============================================================
            
            let tuVi = null;

            try {
                // B2.1: Follow
                await fetch(`${weburl}/wp-json/luan-vo/v1/follow`, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify({ followed_user_id: targetId }),
                    credentials: "include",
                    mode: "cors"
                });

                // B2.2: Lấy danh sách Following
                const resList = await fetch(`${weburl}/wp-json/luan-vo/v1/get-following-users`, {
                    method: "POST",
                    headers: headers,
                    body: JSON.stringify({ page: 1 }),
                    credentials: "include",
                    mode: "cors"
                });

                if (resList.ok) {
                    const jsonList = await resList.json();
                    if (jsonList.success && jsonList.data && Array.isArray(jsonList.data.users)) {
                        // Ở danh sách follow thì phải tìm chính xác ID kẻo lấy nhầm người khác
                        const targetUser = jsonList.data.users.find(u => String(u.id) === targetId);
                        if (targetUser) {
                            tuVi = targetUser.points;
                        }
                    }
                }

            } catch (e) {
                console.error(`[GetTuVi] Fallback lỗi:`, e);
            } finally {
                // ============================================================
                // 🧹 B2.3: UNFOLLOW CHẮC CHẮN (RETRY LOGIC)
                // ============================================================
                let retryCount = 0;
                const maxRetries = 3;
                let isUnfollowed = false;

                while (retryCount < maxRetries && !isUnfollowed) {
                    try {
                        // Nếu là lần retry (retryCount > 0), đợi 1 chút trước khi gọi
                        if (retryCount > 0) await new Promise(r => setTimeout(r, 1000));

                        const resUn = await fetch(`${weburl}/wp-json/luan-vo/v1/unfollow`, {
                            method: "POST",
                            headers: headers,
                            body: JSON.stringify({ unfollow_user_id: targetId }),
                            credentials: "include",
                            mode: "cors"
                        });

                        const dataUn = await resUn.json();

                        // Kiểm tra dựa trên response bạn cung cấp: {"success":true,"message":"Hủy theo dõi thành công."}
                        if (dataUn && dataUn.success) {
                            // console.log(`[GetTuVi] Đã hủy theo dõi ID ${targetId} thành công.`);
                            isUnfollowed = true;
                        } else {
                            console.warn(`[GetTuVi] Hủy theo dõi thất bại (Lần ${retryCount + 1}):`, dataUn.message);
                        }
                    } catch (err) {
                        console.warn(`[GetTuVi] Lỗi mạng khi Unfollow (Lần ${retryCount + 1}):`, err);
                    }
                    retryCount++;
                }

                if (!isUnfollowed) {
                    console.error(`[GetTuVi] ❌ CẢNH BÁO: Không thể hủy theo dõi ID ${targetId} sau ${maxRetries} lần thử. Vui lòng kiểm tra thủ công.`);
                }
            }

            return tuVi;
        }

        async enemyInfo(userId) {
            const myTuVi = await this.getSelfTuVi();
            const opponentTuVi = await this.getTuVi(userId);
            const winRate = this.winRate(myTuVi, opponentTuVi).toFixed(2);
            let notCountAttack = false;
            if (opponentTuVi*10< myTuVi) {
                notCountAttack = true;
            }
            return {
                tuVi: opponentTuVi,
                winRate: winRate,
                notCountAttack: notCountAttack
            };
        }

        async showTotalEnemies(mineId) {
            const data = await this.getUsersInMine(mineId);
            const currentMineUsers = data && data.users ? data.users : [];
            let totalEnemies = 0;
            let totalLienMinh = 0;
            let totalDongMon = 0;
            for (let user of currentMineUsers) {
                if (user.dong_mon) {
                    totalDongMon++;
                } else if (user.lien_minh) {
                    totalLienMinh++;
                } else {
                        totalEnemies++;
                }
            }


            const bonus_display = document.querySelector('#bonus-display');
            const batquai_section = document.querySelector('#batquai-section');
            const pagination = document.querySelector('.pagination');
            const page_indicator = document.querySelector('#page-indicator');
            if (bonus_display) {
                let existingInfo = document.querySelector('.hh3d-mine-info');
                if (!existingInfo) {
                    existingInfo = document.createElement('div');
                    existingInfo.className = 'hh3d-mine-info';
                    //existingInfo.style.right = '5px';
                    existingInfo.style.fontSize = '11px';
                    existingInfo.style.color = '#fff';
                    existingInfo.style.marginLeft = '-1px';
                    existingInfo.style.backgroundColor = 'none';
                    existingInfo.style.padding = '0px 0px';
                    existingInfo.style.border = 'none';
                    existingInfo.style.textAlign = 'left';
                    existingInfo.style.fontFamily = 'Font Awesome 5 Free';
                    bonus_display.prepend(existingInfo);
                    bonus_display.style.display = 'block';
                    batquai_section.style.display = 'block';
                    const observer = new MutationObserver(() => {
                        bonus_display.style.display = 'block';
                        batquai_section.style.display = 'block';
                        pagination.style.display = 'block';
                        page_indicator.style.display = 'block';
                        });
                    observer.observe(bonus_display, { attributes: true, attributeFilter: ['style'] });
                    observer.observe(batquai_section, { attributes: true, attributeFilter: ['style'] });
                    observer.observe(pagination, { attributes: true, attributeFilter: ['style'] });
                    observer.observe(page_indicator, { attributes: true, attributeFilter: ['style'] });
                }

                existingInfo.innerHTML = `
                    <h style="color: #ff5f5f;">🩸Kẻ địch: <b>${totalEnemies}</b></h><br>
                    <h style="color: #ffff00;">🤝Liên Minh: <b>${totalLienMinh}</b></h><br>
                    <h style="color: #9c59bdff;">☯️Đồng Môn: <b>${totalDongMon}</b></h>
                `;
            }
        }

        async addEventListenersToReloadBtn(mineId) {
            const reloadBtn = document.querySelector('#reload-btn');
            if (reloadBtn && !reloadBtn.dataset.listenerAdded) {
                reloadBtn.addEventListener('click', async () => {
                    this.showTotalEnemies(mineId);
                });
                reloadBtn.dataset.listenerAdded = 'true';
            }
        }

        async addEventListenersToMines() {
            const mineImages = document.querySelectorAll(this.mineImageSelector);
            mineImages.forEach(image => {
                if (!image.dataset.listenerAdded) {
                    image.addEventListener('click', async (event) => {
                        const mineId = event.currentTarget.getAttribute('data-mine-id');
                        if (mineId) {
                            this.showTotalEnemies(mineId);
                            this.addEventListenersToReloadBtn(mineId);
                        }
                    });
                    image.dataset.listenerAdded = 'true';
                }
            });
        }

        async showTuVi(myTuVi) {
            if (!myTuVi) return;

            const buttons = document.querySelectorAll('.attack-btn');
            if (buttons.length === 0) return;

            // Lấy mineId từ nút đầu tiên
            const mineId = buttons[0]?.getAttribute('data-mine-id');
            
            // Sắp xếp lại thứ tự hiển thị: Kẻ địch lên đầu (trừ chủ mỏ và bản thân)
            if (mineId && !document.body.dataset.rearranged) {
                await this.rearrangeUsersByEnemy(mineId);
                document.body.dataset.rearranged = mineId; // Đánh dấu đã sắp xếp cho mỏ này
            }

            // Lấy lại buttons sau khi đã sắp xếp
            const buttonsAfterRearrange = document.querySelectorAll('.attack-btn');
            
            for (const btn of buttonsAfterRearrange) {
                if (btn.dataset.tuviAttached === '1') continue;
                btn.dataset.tuviAttached = '1';

                const userId = btn.getAttribute('data-user-id');
                if (!userId) continue;

                try {
                    const opponentTuVi = await this.getTuVi(userId);
                    if (opponentTuVi) {
                        const rate = this.winRate(myTuVi, opponentTuVi).toFixed(2);
                        this.upsertTuViInfo(btn, userId, opponentTuVi, myTuVi);
                    } else {
                        await new Promise(r => setTimeout(r, 500))
                        this.upsertTierInfo(btn, userId);
                    }
                } catch (e) {
                    console.error('getTuVi error', e);
                }

                if (mineId && mineId !== this.currentMineId) {
                    this.currentMineId = mineId;
                    this.showTotalEnemies(mineId);
                    this.addEventListenersToReloadBtn(mineId);
                }
                // nghỉ 1s tránh spam
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        /**
         * Sắp xếp lại các user trong mỏ: đưa kẻ địch lên đầu (trừ chủ mỏ vị trí 0 và bản thân)
         * @param {string} mineId - ID của mỏ
         */
        async rearrangeUsersByEnemy(mineId) {
            try {
                // Lấy dữ liệu users từ API
                const data = await this.getUsersInMine(mineId);
                if (!data || !data.users || data.users.length === 0) return;

                const users = data.users;
                
                // Tạo map userId -> user data để tra cứu nhanh
                const userMap = new Map();
                users.forEach(u => userMap.set(String(u.id), u));

                // Lấy container chứa các user (thường là parent của các attack-btn)
                const buttons = document.querySelectorAll('.attack-btn');
                if (buttons.length === 0) return;

                // Tìm container cha chung của các user items
                const firstBtn = buttons[0];
                const userContainer = firstBtn.closest('.batquai-item')?.parentElement 
                                   || firstBtn.closest('[class*="user"]')?.parentElement
                                   || firstBtn.parentElement?.parentElement;
                
                if (!userContainer) return;

                // Lấy tất cả các user items (phần tử con trực tiếp chứa attack-btn)
                const userItems = Array.from(userContainer.children).filter(el => 
                    el.querySelector('.attack-btn')
                );

                if (userItems.length <= 1) return;

                // Lấy accountId của bản thân
                const selfId = String(accountId);
                
                // Xác định chủ mỏ (vị trí đầu tiên trong danh sách API)
                const ownerId = users.length > 0 ? String(users[0].id) : null;

                // Phân loại các items
                const ownerItem = []; // Chủ mỏ - giữ nguyên vị trí đầu
                const selfItem = [];  // Bản thân - giữ nguyên vị trí
                const enemyItems = []; // Kẻ địch - đưa lên sau chủ mỏ
                const allyItems = [];  // Đồng minh/Liên minh - xuống cuối

                for (const item of userItems) {
                    const btn = item.querySelector('.attack-btn');
                    const userId = btn?.getAttribute('data-user-id');
                    
                    if (!userId) {
                        allyItems.push(item);
                        continue;
                    }

                    const userData = userMap.get(userId);
                    
                    if (userId === ownerId) {
                        // Chủ mỏ - giữ đầu
                        ownerItem.push(item);
                    } else if (userId === selfId) {
                        // Bản thân - giữ nguyên (sẽ để sau chủ mỏ)
                        selfItem.push(item);
                    } else if (userData && !userData.dong_mon && !userData.lien_minh) {
                        // Kẻ địch - đưa lên đầu (sau chủ mỏ và bản thân)
                        enemyItems.push(item);
                    } else {
                        // Đồng môn/Liên minh - xuống cuối
                        allyItems.push(item);
                    }
                }

                // Sắp xếp lại: Chủ mỏ -> Bản thân -> Kẻ địch -> Đồng minh
                const newOrder = [...ownerItem, ...selfItem, ...enemyItems, ...allyItems];

                // Chèn lại các items theo thứ tự mới
                for (const item of newOrder) {
                    userContainer.appendChild(item);
                }

                console.log(`[Hiện Tu Vi] ✅ Đã sắp xếp lại: ${enemyItems.length} kẻ địch lên đầu`);

            } catch (e) {
                console.error('[Hiện Tu Vi] ❌ Lỗi sắp xếp users:', e);
            }
        }

        async startUp() {
            if (document.readyState === 'loading') {
                await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
            }
            this.nonceGetUserInMine = await this.getNonceGetUserInMine();
            this.nonce = await this.getNonce();
            await this.waitForElement('#head_manage_acc', 15000);

            const myTuVi = await this.getSelfTuVi();
            if (myTuVi) {
                await this.showTuVi(myTuVi);
            }

            // quan sát DOM để cập nhật khi các nút attack xuất hiện hoặc nội dung thay đổi
            let __timeout = null;
            const observer = new MutationObserver(() => {
                clearTimeout(__timeout);
                __timeout = setTimeout(async () => {
                    await this.showTuVi(myTuVi);
                }, 200);
            });
            observer.observe(document.body, { childList: true, subtree: true });

            this.addEventListenersToMines();
            // MutationObserver chính để thêm listener cho các mỏ mới
            const mainObserver = new MutationObserver(() => {
                this.addEventListenersToMines();
            });

            mainObserver.observe(document.body, { childList: true, subtree: true });
        }
    }
    // ===============================================
    // Bộ lọc tông môn
    // ===============================================
    async function getDivContent(url, selector) {
        const logPrefix = '[HH3D Auto]';

        console.log(`${logPrefix} ▶️ Đang tải trang từ ${url} để lấy nội dung...`);
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const html = await response.text();

            // Sử dụng DOMParser để phân tích mã HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Tìm phần tử bằng selector
            const element = doc.querySelector(selector);
            
            if (element) {
                const content = element.innerHTML;
                console.log(`${logPrefix} ✅ Đã trích xuất thành công nội dung: ${content}`);
                return content;
            } else {
                console.error(`${logPrefix} ❌ Không tìm thấy phần tử với bộ chọn: ${selector}`);
                return null;
            }
        } catch (e) {
            console.error(`${logPrefix} ❌ Lỗi khi tải trang hoặc trích xuất nội dung:`, e);
            return null;
        }
    }

    async function kiemTraTenTong(tenTong) {
        try {
            // Gọi GitHub API để lấy nội dung gist
            const response = await fetch('https://api.github.com/gists/7e1499363ce6aca6215bfaf10267d90d');

            if (!response.ok) {
                throw new Error(`Không thể tải gist: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Lấy nội dung của file (ở đây là gistfile1.txt, bạn có thể đổi nếu tên khác)
            const file = data.files['tên tông cho tool'];
            if (!file) {
                throw new Error("Không tìm thấy file trong gist.");
            }

            // Nội dung file ở dạng text → parse sang JSON
            const danhSachTong = JSON.parse(file.content);

            // Chuẩn hóa tên tông nhập vào
            const tenTongThuong = tenTong.toLowerCase();

            // Kiểm tra tồn tại
            const isExist = danhSachTong.some(tong => tong.toLowerCase() === tenTongThuong);

            return isExist;

        } catch (error) {
            console.error('Lỗi khi kiểm tra tông:', error);
            return false;
        }
    }

    async function checkTongMon() {
        const tongMonHopLe =  sessionStorage.getItem('tong_mon_hop_le') === '1'|| false;
        if (!tongMonHopLe) {
            const tongMon = await getDivContent(weburl + 'danh-sach-thanh-vien-tong-mon?t', '.name-tong-mon');
            const isValid = await kiemTraTenTong(tongMon);
            if (isValid) {
                sessionStorage.setItem('tong_mon_hop_le', '1');
                return true;
            } else {
                sessionStorage.setItem('tong_mon_hop_le', '0');
                return false;
            } 
        } else {
            return true;
        } 
    }

    // ===============================================
    // KHỞI ĐỘNG CHƯƠNG TRÌNH
    // ===============================================

   
    // ===============================================
    // KHỞI TẠO SCRIPT
    // ===============================================
    const taskTracker = new TaskTracker();
    const accountId = await getAccountId();
    if (accountId) {
            let accountData = taskTracker.getAccountData(accountId);
            console.log(`[HH3D] ✅ Account ID: ${accountId}`);
            console.log(`[HH3D] ✅ Đã lấy dữ liệu tài khoản: ${JSON.stringify(accountData)}`);
        } else {
            console.warn('[HH3D] ⚠️ Không thể lấy ID tài khoản.');
        }
    const vandap = new VanDap();
    const dothach = new DoThach();
    const hoangvuc = new HoangVuc();
    const luanvo = new LuanVo();
    const bicanh = new BiCanh();
    const khoangmach = new KhoangMach();
    const hoatdongngay = new HoatDongNgay();
    // Khởi tạo và chạy các class
    const uiStyles = new UIMenuStyles();
    uiStyles.addStyles();

    const createUI = new UIInitializer('.load-notification.relative', LINK_GROUPS, accountId);
    createUI.start();
    const tienduyen = new TienDuyen();
    await tienduyen.init();
    const automatic = new AutomationManager();
    new Promise(resolve => setTimeout(resolve, 2000)); // Đợi 2 giây để UI ổn định
    const hienTuviKM = new hienTuviKhoangMach()
    automatic.checkAndStart();
    if (location.pathname.includes('khoang-mach') || location.href.includes('khoang-mach')) {
        hienTuviKM.startUp();
    }
})();
