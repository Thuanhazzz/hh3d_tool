// ==UserScript==
// @name         HH3D Tool Mobile - Userscript
// @namespace    https://github.com/yourusername/hh3d-tool
// @version      1.0.0
// @description  Công cụ tự động hóa hoathinh3d cho Tampermonkey
// @author       Thuanha (Krizk)
// @match        *://hoathinh3d.gg/*
// @match        *://hoathinh3d.li/*
// @match        *://hoathinh3d.*/*
// @icon         https://hoathinh3d.gg/favicon.ico
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/Thuanhazzz/hh3d_tool/main/HH3D-Tool-Userscript.user.js
// @downloadURL  https://raw.githubusercontent.com/Thuanhazzz/hh3d_tool/main/HH3D-Tool-Userscript.user.js
// ==/UserScript==

(function() {
    'use strict';

    // ⚠️ Early exit if running inside an iframe
    if (window !== window.top) {
        console.log('⏭️ Running inside iframe, skipping extension initialization');
        return;
    }

    // ⚠️ Early exit if not hoathinh3d domain
    if (!window.location.hostname.includes('hoathinh3d.')) {
        console.log('⏭️ Not hoathinh3d domain, skipping extension');
        return;
    }

    const BASE_URL = window.location.origin;
    console.log('🎯 HH3D Tool Userscript Started:', BASE_URL);

    // ============================================================================
    // STORAGE WRAPPER (localStorage thay vì chrome.storage)
    // ============================================================================
    const Storage = {
        get: (keys, callback) => {
            const result = {};
            if (Array.isArray(keys)) {
                keys.forEach(key => {
                    const value = localStorage.getItem(key);
                    result[key] = value ? JSON.parse(value) : undefined;
                });
            } else {
                const value = localStorage.getItem(keys);
                result[keys] = value ? JSON.parse(value) : undefined;
            }
            if (callback) callback(result);
            return Promise.resolve(result);
        },
        
        set: (data, callback) => {
            Object.entries(data).forEach(([key, value]) => {
                localStorage.setItem(key, JSON.stringify(value));
            });
            if (callback) callback();
            return Promise.resolve();
        },
        
        remove: (keys, callback) => {
            if (Array.isArray(keys)) {
                keys.forEach(key => localStorage.removeItem(key));
            } else {
                localStorage.removeItem(keys);
            }
            if (callback) callback();
            return Promise.resolve();
        }
    };

    // ============================================================================
    // HELPER FUNCTIONS
    // ============================================================================
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function normalizeText(text) {
        if (!text) return '';
        return text.toString()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s]/gi, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function formatResult(key, raw = {}) {
        return {
            key,
            status: raw.status || 'pending',
            message: raw.message || '',
            percent: raw.percent || 0,
            nextTime: raw.nextTime || 0,
            data: raw.data || {},
            timestamp: Date.now()
        };
    }

    // Extract tokens from HTML
    function extractSecurityToken(html) {
        const regex = /"securityToken"\s*:\s*"([^"]+)"/i;
        const match = html.match(regex);
        return match ? match[1] : null;
    }

    function extractWpRestNonce(html) {
        const m = html.match(/"restNonce"\s*:\s*"([a-f0-9]+)"/i);
        return m ? m[1] : null;
    }

    function extractProfileInfo(html) {
        const profileIdMatch = html.match(/href=["']\/profile\/(\d+)["']/i);
        const profileId = profileIdMatch ? parseInt(profileIdMatch[1]) : null;
        
        const userNameMatch = html.match(/id=["']ch_head_name["'][^>]*>.*?<div[^>]*>(.*?)<\/div>/i);
        const userName = userNameMatch ? userNameMatch[1].trim() : null;
        
        const isLogged = !html.includes('id="custom-open-login-modal"');
        
        return { profileId, userName, isLogged };
    }

    // ============================================================================
    // FETCH QUEUE
    // ============================================================================
    const fetchQueue = [];
    let isProcessing = false;

    async function queueFetch(url, options = {}) {
        return new Promise((resolve, reject) => {
            fetchQueue.push({ url, options, resolve, reject });
            if (!isProcessing) processQueue();
        });
    }

    async function processQueue() {
        if (fetchQueue.length === 0) {
            isProcessing = false;
            return;
        }
        isProcessing = true;
        const { url, options, resolve, reject } = fetchQueue.shift();
        try {
            const response = await fetch(url, options);
            resolve(response);
        } catch (error) {
            reject(error);
        }
        await wait(300);
        processQueue();
    }

    // ============================================================================
    // ANSWER DATABASE (Vấn Đáp)
    // ============================================================================
    const ANSWER_DATABASE = {
        "1 Trong 2 Admin của website HoatHinh3D là ai ? (Biệt danh chính xác ở web)": "Từ Dương",
        "Ai là huynh đệ và cũng là người thầy mà Vương Lâm trong Tiên Nghịch kính trọng nhất ?": "Tư Đồ Nam",
        "Ai là mẹ của Đường Tam?": "A Ngân",
        "Ai là người đứng đầu Vũ Hồn Điện?": "Bỉ Bỉ Đông",
        "Ai là người thầy của Đường Tam?": "Đại Sư",
        "Ai là nhân vật chính trong bộ phim hoạt hình trung quốc Thần Mộ ?": "Thần Nam",
        "Ám tinh giới được xuất hiện trong bộ phim hoạt hình nào dưới đây ?": "Tinh Thần Biến",
        "Bách Lý Đông Quân là nhân vật trong bộ hoạt hình trung quốc nào sau đây ?": "Thiếu Niên Bạch Mã Tuý Xuân Phong",
        "Bạch Nguyệt Khôi là tên nhân vật chính trong bộ phim hoạt hình trung quốc nào sau đây ?": "Linh Lung",
        "Bạch Tiểu Thuần là nhân vật chính trong bộ hoạt hình trung quốc nào ?": "Nhất Niệm Vĩnh Hằng",
        "Bạch Tiểu Thuần trong Nhất Niệm Vĩnh Hằng luôn được ai âm thầm giúp đỡ ?": "Đỗ Lăng Phỉ",
        "Bộ phim nào sau đây thuộc tiểu thuyết của tác giả Thiên Tằm Thổ Đậu": "Tất cả đáp án",
        "Các cấp bậc nào sau đây thuộc phim Đấu Phá Thương Khung ?": "Đấu Tông",
        "Cháu dượng của Bạch Tiểu Thuần trong Nhất Niệm Vĩnh Hằng là ai ?": "Tống Khuyết",
        "Chủ nhân đời trước của Vẫn Lạc Tâm Viêm trong Đấu Phá Thương Khung là ai ?": "Diệu Thiên Hỏa",
        "Công pháp gì giúp Tiêu Viêm trong Đấu Phá Thương Khung hấp thụ nhiều loại dị hỏa ?": "Phần Quyết",
        "Công pháp nào sau đây là của Hàn Lập trong Phàm Nhân Tu Tiên ?": "Tất cả đáp án",
        "Cơ Tử Nguyệt là nhân vật trong các bộ hoạt hình trung quốc nào sau đây ?": "Già Thiên",
        "Dạ Táng còn là biệt danh của ai trong Nhất Niệm Vĩnh Hằng ?": "Bạch Tiểu Thuần",
        "Danh xưng Tàn Thi Bại Thuế là của nhân vật nào trong Hoạ Giang Hồ Chi Bất Lương Nhân ?": "Hàng Thần",
        "Diễm Linh Cơ là nhân vật trong phim hoạt hình trung quốc nào ?": "Thiên Hành Cửu Ca",
        "Diệp Phàm là nhân vật chính trong bộ hoạt hình trung quốc nào ?": "Già Thiên",
        "Diệp Thần trong Tiên Võ Đế Tôn gia nhập Tông Môn nào đầu tiên ?": "Chính Dương Tông",
        "Dược Trần trong Đấu Phá Thương Khung đã từng bị đồ đệ nào phản bội ?": "Hàn Phong",
        "Đại ca của Tiêu Viêm trong Đấu Phá Thương Khung tên gì ?": "Tiêu Đỉnh",
        "Đàm Vân là nhân vật chính trong bộ phim hoạt hình trung quốc nào sau đây ?": "Nghịch Thiên Chí Tôn",
        "Đạo lữ của Hàn Lập là ai ?": "Nam Cung Uyển",
        "Đâu là nhân vật chính trong phim Bách Luyện Thành Thần ?": "La Chinh",
        "Đâu là Thái Cổ Thập Hung trong phim Thế Giới Hoàn Mỹ ?": "Tất cả đáp án",
        "Đâu là tuyệt kỹ số 1 Hạo Thiên Tông mà Đường Hạo dạy cho con trai trong Đấu La Đại Lục ?": "Đại Tu Di Chùy",
        "Đấu Sát Toàn Viên Kiếm là một kỹ năng trong bộ phim hoạt hình trung quốc nào ?": "Thần Ấn Vương Toạ",
        "Độc Cô Bác trong Đấu La Đại Lục có vũ hồn gì ?": "Bích Lân Xà",
        "Em trai ruột của Thạch Hạo trong Thế Giới Hoàn Mỹ là ai ?": "Tần Hạo",
        "Hàn Lập sở hữu những vật phẩm nào dưới đây ?": "Thanh Trúc Phong Vân Kiếm",
        "Hàn Lập trong Phàm Nhân Tu Tiên đến Thất Huyền Môn bái ai làm thầy ?": "Mặc Đại Phu",
        "Hàn Lâp trong Phàm Nhân Tu Tiên gia nhập môn phái nào đầu tiên ?": "Thất Huyền Môn",
        "Hàn Lập trong Phàm Nhân Tu Tiên từng cứu ai mà bị hấp thụ tu vi giảm xuống Luyện Khí Kỳ ?": "Nam Cung Uyển",
        "Hoang Thiên Đế là nhân vật chính trong bộ phim hoạt hình trung quốc nổi tiếng nào ?": "Thế Giới Hoàn Mỹ",
        "Hoắc Vũ Hạo là hậu nhân của ai trong Sử Lai Khắc ?": "Đái Mộc Bạch",
        "Hồn hoàn màu nào mạnh nhất?": "Đỏ",
        "Huân Nhi là công chúa của bộ tộc nào?": "Cổ Tộc",
        "Khi ở Già Nam Học Viện, Tiêu Viêm thu phục được loại dị hỏa nào ?": "Vẫn Lạc Tâm Viêm",
        "Khô Lâu Đà Chủ xuất hiện trong bộ phim hoạt hình nào dưới đây ?": "Võ Thần Chúa Tể",
        "Kính Huyền trong Quyến Tư Lượng là hậu duệ của tộc nào ?": "Thần Tộc",
        "Lạc Ly trong Đại Chúa Tể là nhân vật trong Tộc nào ?": "Lạc Thần Tộc",
        "Lâm Động trong Vũ Động Càn Khôn học được Linh Võ Học nào khi vào bia cổ Đại Hoang ?": "Đại Hoang Tù Thiên Chỉ",
        "Lâm Động trong Vũ Động Càn Khôn luyện hóa Tổ Phù nào đầu tiên ?": "Thôn Phệ Tổ Phù",
        "Lâm Động trong Vũ Động Càn Khôn sử dụng vũ khí loại nào sau đây ?": "Thương",
        "Lâm Phong là nhân vật trong bộ hoạt hình trung quốc nào sau đây ?": "Vạn Giới Độc Tôn",
        "Lâm Thất Dạ là nhân vật trong bộ hoạt hình trung quốc nào sau đây ?": "Trảm Thần",
        "Lâm Thất Dạ là nhân vật trong bộ phim hoạt hình trung quốc nào sau đây ?": "Trảm Thần",
        "Lâm Thất Dạ trong Trảm Thần sở hữu sức mạnh của vị thần nào ?": "Thiên Sứ",
        "Long Tuyền Kiếm xuất hiện trong bộ phim hoạt hình nào dưới đây ?": "Họa Giang Hồ Chi Bất Lương Nhân",
        "Lục Tuyết Kỳ trong Tru Tiên thuộc Phong nào trong Thanh Vân Môn?": "Tiểu Trúc Phong",
        "Lý Tinh Vân là một nhân vật trong bộ phim hoạt hình trung quốc nào sau đây ?": "Họa Giang Hồ Chi Bất Lương Nhân",
        "Lý Tinh Vân trong Họa Giang Hồ Chi Bất Lương Nhân sử dụng vũ khí nào sau đây ?": "Long Tuyền Kiếm",
        "Lý Trường Thọ trong Sư Huynh A Sư Huynh xuyên không về Hồng Hoang bái sư ở đâu ?": "Độ Tiên Môn",
        "Man Hồ Tử trong phim \"Phàm Nhân Tu Tiên\" tu luyện công pháp nào?": "Thác Thiên Ma Công",
        "Mẫu thân của La Phong trong Thôn Phệ Tinh Không tên là gì ?": "Cung Tâm Lan",
        "Mẹ của Mạnh Xuyên trong Thương Nguyên Đồ tên là gì ?": "Bạch Niệm Vân",
        "Mẹ của Tần Trần là ai ?": "Tần Nguyệt Trì",
        "Mẹ của Thạch Hạo trong Thế Giới Hoàn Mỹ tên là gì": "Tần Di Ninh",
        "Mối tình đầu của Diệp Thần trong Tiên Võ Đế Tôn là ai ?": "Cơ Ngưng Sương",
        "Mục đích chính tu luyện của Tần Vũ trong Tinh Thần Biến là gì ??": "Vì muốn được cưới Khương Lập",
        "Mục đích tu luyện của Tần Vũ trong Tinh Thần Biến là gì?": "Vì muốn được cưới Khương Lập",
        "Mục đích tu luyện của Vương Lâm trong Tiên Nghịch theo diễn biến phim hiện tại là gì ?": "Báo Thù",
        "Mục Trần trong Đại Chúa Tể liên kết Huyết Mạch với ?": "Cửu U Tước",
        "Mục Vân là nhân vật trong bộ hoạt hình trung quốc nào sau đây ?": "Vô Thượng Thần Đế",
        "Nam chính trong bộ hoạt hình trung quốc Ám Hà Truyện là ai ?": "Tô Mộ Vũ",
        "Nam chính trong bộ Quyến Tư Lượng là ai ?": "Kính Huyền",
        "Nghịch Hà Tông là Tông Môn trong bộ hoạt hình trung quốc nào sau đây ?": "Nhất Niệm Vĩnh Hằng",
        "Nghịch Thiên Nhi Hành là một nhân vật trong bộ phim hh3d nào sau đây ?": "Vũ Canh Kỷ",
        "Ngụy Anh (Ngụy Vô Tiện) là nhân vật trong bộ hhtq nào sau đây ?": "Ma Đạo Tổ Sư",
        "Người bạn thuở nhỏ của Trương Tiểu Phàm trong Tru Tiên là ai ?": "Lâm Kinh Vũ",
        "Nhân vật Bách Lý Đồ Minh xuất hiện trong phim hoạt hình nào dưới đây ?": "Trảm Thần Chi Phàm Trần Thần Vực",
        "Nhân vật chính của \"Thần Ấn Vương Tọa\" là ai?": "Long Hạo Thần",
        "Nhân vật chính của Đấu La Đại Lục là ai?": "Đường Tam",
        "Nhân vật chính Lý Trường Thọ trong Sư Huynh A Sư Huynh đã tỏ tình với ai ?": "Vân Tiêu",
        "Nhân vật chính trong Đấu Chiến Thiên Hạ là ai?": "Đại Phong",
        "Nhân vật chính trong Man Hoang Tiên Giới là ai ?": "Lục Hàng Chi",
        "Nhân vật chính trong Quân Tử Vô Tật là ai?": "Dao Cơ",
        "Nhân vật chính trong Ta Có Thể Giác Ngộ Vô Hạn là ai?": "Tiêu Vân",
        "Nhân vật chính trong Thương Nguyên đồ là ai ?": "Mạnh Xuyên",
        "Nhân vật chính trong Yêu Thần Ký tên là gì ?": "Nhiếp Ly",
        "Nhân vật nào luôn bất bại trong phim Hoạt Hình Trung Quốc, được ví như One-Punch Man ?": "Từ Dương",
        "Nhân vật nào sau đây được mệnh danh là Vua Lỳ Đòn trong Đấu Phá Thương Khung ?": "Phượng Thanh Nhi",
        "Nhị ca của Tiêu Viêm trong Đấu Phá Thương Khung tên gì ?": "Tiêu Lệ",
        "Nhiếp Phong là nhân vật chính trong phim hoạt hình trung quốc nào ?": "Chân Võ Đỉnh Phong",
        "Ninh Diêu là một nhân vật trong bộ phim hoạt hình trung quốc nào sau đây ?": "Kiếm Lai",
        "Nữ chính cũng là vợ Đông Bá Tuyết Ưng trong Tuyết Ưng Lĩnh Chủ là ai sau đây ?": "Dư Tĩnh Thu",
        "Nữ chính trong bộ Quyến Tư Lượng là ai ?": "Đồ Lệ",
        "Ông nội của Lâm Động trong Vũ Động Càn Khôn là ai ?": "Lâm Chấn Thiên",
        "Phụ Thân của Lâm Động trong Vũ Động Càn Khôn là ai ?": "Lâm Khiếu",
        "Phương Hàn là nhân vật trong bộ hoạt hình trung quốc nào sau đây ?": "Vĩnh Sinh",
        "Phương Hàn trong Vĩnh Sinh nhận được Giao Phục Hoàng Tuyền Đồ từ ai ?": "Bạch Hải Thiện",
        "Phương Hàn trong Vĩnh Sinh xuất thân là gì ở nhà họ Phương ?": "Nô Bộc",
        "Phượng Thanh Nhi trong Đấu Phá Thương Khung thuộc chủng tộc nào ?": "Thiên Yêu Hoàng Tộc",
        "Số hiệu vị thần của main trong Trảm Thần: Phàm Trần Thần Vực là số mấy ?": "003",
        "Sử Lai Khắc Thất Quái đã từng đến nơi nào để luyện tập?": "Hải Thần Đảo",
        "Sư mẫu của Bạch Tiểu Thuần trong Nhất Niệm Vĩnh Hằng là ai ?": "Hứa Mị Nương",
        "Sư phụ của Bạch Tiểu Thuần trong Nhất Niệm Vĩnh Hằng là ai ?": "Lý Thanh Hậu",
        "Sư phụ của Lý Trường Thọ là ai ?": "Tề Nguyên",
        "Sư phụ mà Diệp Thần yêu trong Tiên Võ Đế Tôn là ai ?": "Sở Huyên Nhi",
        "Sư Phụ thứ 2 của Lý Trường Thọ trong phim": "Thái Thanh Thánh Nhân",
        "Tại sao Đường Tam bị Đường Môn truy sát ở tập đầu phim Đấu La Đại Lục ?": "Học trộm tuyệt học bổn môn",
        "Tại sao Hàn Lập khi gặp Phong Hi không chạy mà ở lại giúp đỡ chế tạo Phong Lôi Sí ?": "Vì đánh không lại",
        "Tần Mục là nhân vật chính trong bộ phim hoạt hình trung quốc nào sau đây ?": "Mục Thần Ký",
        "Tần Nam là nhân vật chính trong bộ hoạt hình trung quốc nào sau đây ?": "Tuyệt Thế Chiến Hồn",
        "Tần Vũ trong Tinh Thần Biến được tặng pháp bảo siêu cấp vip pro nào để tu luyện nhanh chóng ?": "Khương Lan Tháp",
        "Tần Vũ trong Tinh Thần Biến khiếm khuyết đan điền nhờ đâu mới có thể tu luyện ?": "Lưu Tinh Lệ",
        "Test": "Test",
        "Thánh nữ nào trong Già Thiên bị nhân vật chính Diệp Phàm lấy mất cái áo lót ?": "Diêu Hi",
        "Thần Thông Bí Cảnh xuất hiện trong bộ phim hoạt hình nào dưới đây ?": "Vĩnh Sinh",
        "Thần vị mà Đường Tam đạt được là gì?": "Hải Thần và Tu La Thần",
        "Thế lực nào là đối thủ lớn nhất của Tiêu Viêm trong Đấu Phá Thương Khung?": "Hồn Điện",
        "Thiên Hoả Tôn Giả trong Đấu Phá Thương Khung dùng thi thể của ai để hồi sinh ?": "Vân Sơn",
        "Thú cưng Thôn Thôn trong Nguyên Tôn sinh ra có sức mạnh ngang cảnh giới nào ?": "Thái Sơ Cảnh",
        "Tiêu Khinh Tuyết xuất hiện trong bộ hoạt hình nào dưới đây ?": "Tuyệt Thế Chiến Hồn",
        "Tiêu Thần là nhân vật chính trong bộ phim hoạt hình Trung Quốc nào sau đây ?": "Trường Sinh Giới",
        "Tiêu Viêm đã lập nên thế lực nào khi ở Học Viện Già Nam ?": "Bàn Môn",
        "Tiêu Viêm trong Đấu Phá Thương Khung đã Hẹn Ước 3 Năm với ai ?": "Nạp Lan Yên Nhiên",
        "Tiêu Viêm trong Đấu Phá Thương Khung sử dụng loại vũ khí nào sau đây ?": "Thước",
        "Tiêu Viêm trong Đấu Phá Thương Khung thuộc gia tộc nào?": "Tiêu Gia",
        "Tỉnh Cửu là nhân vật chính trong bộ phim hoạt hình trung quốc nào sau đây ?": "Đại Đạo Triều Thiên",
        "Tình đầu của Diệp Phàm trong Già Thiên là ai ?": "Lý Tiểu Mạn",
        "Trần Bình An là nam chính trong bộ phim hoạt hình trung quốc nào ?": "Kiếm Lai",
        "Triệu Ngọc Chân là nhân vật trong bộ hoạt hình trung quốc nào sau đây ?": "Thiếu Niên Bạch Mã Túy Xuân Phong",
        "Trong bộ Đấu Phá Thương Khung, Tiêu Viêm tìm đến ai để cứu Dược Lão ?": "Phong Tôn Giả",
        "Trong bộ Tiên Nghịch, nhân vật chính Vương Lâm khi ở quê nhà còn có tên khác là gì ?": "Thiết Trụ",
        "Trong Đấu La Đại Lục, Đường Hạo là gì của Đường Tam?": "Cha",
        "Trong Già Thiên, thể chất Diệp Phàm là thể chất gì ?": "Hoang Cổ Thánh Thể",
        "Trong Phàm Nhân Tu Tiên ai bị luyện thành khôi lỗi Khúc Hồn ?": "Trương Thiết",
        "Trong phim Tiên Nghịch, Vương Lâm vô tình có được pháp bảo nghịch thiên nào ?": "Thiên Nghịch Châu",
        "Trong Tiên Nghịch, Vương Lâm nhận được truyền thừa gì ở Cổ Thần Chi Địa ?": "Ký Ức",
        "Trong Tru Tiên, Điền Bất Dịch là thủ tọa của Phong nào?": "Đại Trúc Phong",
        "Trong Vĩnh Sinh - Phương Hàn hẹn ước 10 năm cùng với ai ?": "Hoa Thiên Đô",
        "Trước khi đến Linh Khê Tông, Bạch Tiểu Thuần trong Nhất Niệm Vĩnh Hằng ở đâu ?": "Mạo Nhi Sơn Thôn",
        "Trương Tiểu Phàm trong phim Tru Tiên còn có tên gọi là ?": "Quỷ Lệ",
        "Trương Tiểu Phàm trong Tru Tiên từng được nhận vào môn phái nào?": "Thanh Vân Môn",
        "Tử Nghiên trong Đấu Phá Thương Khung thuộc chủng tộc nào ?": "Thái Hư Cổ Long",
        "Vân Triệt là tên nhân vật chính trong bộ phim hoạt hình trung quốc nào sau đây ?": "Nghịch Thiên Tà Thần",
        "Vũ Canh là nhân vật trong bộ hoạt hình trung quốc nào sau đây ?": "Vũ Canh Kỷ",
        "Vũ hồn của Chu Trúc Thanh là gì?": "U Minh Linh Miêu",
        "Vũ hồn của Đới Mộc Bạch là gì?": "Bạch Hổ",
        "Vũ hồn của Mã Hồng Tuấn là gì?": "Hỏa Phượng Hoàng",
        "Vũ hồn của Tiểu Vũ là gì?": "Nhu Cốt Thỏ",
        "Vũ hồn thứ hai của Đường Tam là gì?": "Hạo Thiên Chùy",
        "Vũ khí của Đàm Vân trong Nghịch Thiên Chí Tôn là gì ?": "Hồng Mông Thần Kiếm",
        "Vũ khí mà Tiêu Viêm trong Đấu Phá Thương Khung luôn mang bên mình có tên gọi là gì ?": "Huyền Trọng Xích",
        "Vương Lâm trong phim Tiên Nghịch dựa vào gì để vô địch cùng cảnh giới ?": "Cực Cảnh",
        "xxxx": "xx",
        "Y Lai Khắc Tư là một nhân vật trong bộ phim hoạt hình trung quốc nào sau đây ?": "Cả 1 và 2",
        "Ai là chủ nhân của Thôn Thôn trong Nguyên Tôn?" : "Yêu Yêu",	
        "Ai là sư phụ của Diệp Phàm trong Già Thiên?":"Lý Nhược Ngu",	
        "Bạch Nguyệt Khôi còn có tên gọi khác là gì?" : "Bà chủ Bạch",	
        "Bộ phim Thiên Bảo Phục Yêu Lục lấy bối cảnh thời kỳ nào??" : "Đường",	
        "Cha của La Phong tên gì?" : "La Hồng Quốc",	
        "Chu Tước Thánh Sứ trong Tru Tiên Là Ai?" : "U Cơ",	
        "Con gái của quỷ vương trong Tru Tiên tên là gì?" : "Bích Dao",
        "Cố Hà là luyện dược sư mấy phẩm?" : "Thất Phẩm",	
        "Cố Hà trong Đấu Phá Thương Khung lúc xuất hiện ở Vân Lam Tông là luyện dược sư mấy phẩm?" : "Lục Phẩm",	
        "Cô Kiếm Tiên trong phim Thiếu Niên Ca Hành là ai?" : "Lạc Thanh Dương",	
        "Dương Khai trong Võ Luyện Đỉnh Phong song tu với ai đầu tiên?" : "Tô Nhan",
        "Gia gia Thạch Hạo trong phim Thế Giới Hoàn Mỹ tên gì?" : "Thạch Trung Thiên",	
        "ID game Diệp Tu sử dụng trong phim Toàn Chức Cao Thủ?" : "cả 1 và 2",	
        "Lâm Thất Dạ trong phim Trảm Thần gặp phải biến cố gì?" : "Bị mù",	
        "Lý Hàn Y trong phim Thiếu Niên Ca Hành sử dụng vũ khí gì?" : "cả 1 và 2",	
        "Mục Thần Ký được chuyển thể từ tiểu thuyết của tác giả nào?" : "Trạch Trư",	
        "Mục Thần Ký được chuyển thể từ tiểu thuyết nào?" : "Thạch Thư",	
        "Nam chính của phim Đô Thị Cổ Y Tiên là?" : "Diệp Bất Phàm",	
        "Nam chính Đại Đạo Triều Thiên, Triệu Lạc Nguyệt đến từ phong nào?" : "Thần Mạt Phong",	
        "Nam chính trong phim Sơn Hà Kiếm Tâm là ai?" : "Yến Vô Sư",	
        "Nam chính trong phim Ta Là Đại Thần Tiên là?" : "Thời Giang",	
        "Nhân vật chính trong phim Duy Ngã Độc Thần?" : "Ninh Thần",	
        "Nhân vật chính trong phim Sư Huynh a Sư Huynh là ai?" : "Lý Trường Thọ",	
        "Nhân vật chính trong phim Ta có thể giác ngộ vô hạn?" : "Tiêu Vân",	
        "Nhân vật chính trong phim Tân Thời Minh Nguyệt?" : "Kính Thiên Minh",	
        "Nhân vật chính trong phim Toàn Chức Cao Thủ là ai?" : "Diệp Tu",	
        "Nhân vật chính trong phim Trấn Hồn Nhai là?" : "Hạ Linh",	
        "Nhân vật chính trong phim Vạn Giới Tiên Tung là ai?" : "Diệp Tinh Vân",		
        "Nhân vật chính trong Ta Có Thể Giác Ngộ Vô Hạn là ai?" : "Tiêu Vân",	
        "Nhân vật chính trong Tần Thời Minh Nguyệt?" : "Kinh Thiên Minh",	
        "Sở Phong trong Tu La Võ Thần có Huyết Mạch gì?" : "Thiên Lôi",	
        "Tần Mục trong Mục Thần Ký lớn lên ở đâu?" : "Tàn Lão Thôn",	
        "Thế giới trong Mục Thần Ký chia thành mấy đại vực chính?" : "9",	
        "Thê tử của Điền Bất Dịch trong Tru Tiên là ai?" : "Tô Như",	
        "Trong các bộ phim sau, bộ nào nhân vật chính có hệ thống?" : "Ta có thể giác Ngộ Vô hạn",	
        "Trong Kiếm Lai, khi Man Châu Động Thiên đứng trước nguy cơ bị hủy diệt, là ai đã đứng ra bảo vệ người dân trong trấn?" : "Tề Tĩnh Xuân",	
        "Trong Na Tra: Ma Đồng Giáng Thế Na Tra được sinh ra từ gì?" : "Ma Hoàn",	
        "Trong phim Đại Đạo Triều Thiên, Tỉnh Cửu đã cùng thư đồng đến đâu để tu luyện?" : "Thanh Sơn Tông",	
        "Trong phim Đại Đạo Triều Thiên, Tỉnh Cửu đã cùng thư đồng đến đâu tu luyện?" : "Thanh Sơn Tông",	
        "Trong phim Đại Đạo Triều Thiên, Tỉnh Cửu đã thu nhận ai làm thư đồng?" : "Lưu Thập Tuế",	
        "Trong phim Đại Đạo Triều Thiên, Triệu Lạp Nguyệt đến từ phong nào?" : "Thần Mạt Phong",	
        "Trong Phim Na Tra: Ma Đồng Náo Hải, Cha của Ngao Bính tên là?" : "Ngao Quảng",	
        "Tư Mã Ý trong phim Hỏa Phụng Liêu Nguyên có tên tự là gì?" : "Trọng Đạt",	
        "Vô Tâm trong phim Thiếu Niên Ca Hành còn có tên gọi khác là gì?" : "Diệp An Thế",	
        "Vương Lâm trong Tiên Nghịch ở đâu có Tiên Ngọc đột phá Anh Biến?" : "Đi cướp",	
        "Ai sau đây làm lễ cưới với Lý Mộ Uyển trong Tiên Nghịch thì bị anh Lâm giết?" : "Tôn Chấn Vĩ",
        "Ôn Thiên Nhân trong Phàm Nhân Tu Tiên tu luyện công pháp gì?" : "Lục Cực Chân Ma Công",
        "Trong Đấu Phá Thương Khung, Tiêu Viêm hơn Cổ Hà ở điểm gì ?" : "Dị Hỏa",
        "Tam Thánh Niết là biệt danh của ai trong Họa Giang Hồ Chi Bất Lương Nhân?" : "Lý Tinh Vân",
        "Liễu Thất Nguyệt trong Thương Nguyên Đồ sử dụng vũ khí gì ?" : "Cung",
        "Trong phim Vạn Cổ Tối Cường Tông, Quân Thường Tiếu chiêu mộ ai lam đệ tử đầu tiên?" : "Lục Thiên Thiên",
        "Phong Hi trong Phàm Nhân Tu Tiên là yêu thú nào?" : "Liệt phong thú",
        "Sư tỷ của Nguyên Dao trong Phàm Nhân Tu Tiên tên là gì?" : "Nghiên Lệ",
        "Trong Đấu Phá Thương Khung, khi Vân Lam Tông giải tán thì Vân Vận đã gia nhập tông phái nào ?" : "Hoa Tông",
        "Phong Hi trong Phàm Nhân Tu Tiên tại sao được gọi là Đại Thiện Nhân ?" : "Cả 1 và 2",	
        
        "Loại đan dược giúp Tiêu Viêm khôi phục thiên phú tên là gì?": "D. Phá Tông Đan",
        "Ai là người đã chặt mất một bên chân của Lão Què trong《Mục Thần Ký》?": "Duyên Khang Quốc sư",
        "Lão Què trong 《Mục Thần Ký) vì sao mất một bên chân": "Vì ăn trộm Đế Điệp",
        "Thanh Liên địa tâm hỏa xếp thứ mấy trong Dị Hỏa bảng 《Đấu Phá Thương Khung》?": "19",
        "Ai là người kế thừa thần vị Thiên Sứ trong 《Đấu La Đại Lục》?": "B. Thiên Nhận Tuyết",
        "Thần khí mà Vân Thanh Nham mang trở về từ tiên giới": "Trảm Thiên Thần Kiếm",
        "Nhân vật Medusa trong 《Đấu Phá Thương Khung》 vốn là thủ lĩnh của tộc nào?": "Xà Nhân Tộc",
        "Thành phố nơi câu chuyện ban đầu trong 《Quỷ Bí Chi Chủ》 diễn ra là?": "B. Tingen",
        "ID game Diệp Tu sử dụng trong phim Toàn Chức Cao Thủ?": "cả 1 và 2",
        "Trong 《Mục Thần Ký》 trước Tần Mục, ai là giáo chủ của Thiên Ma giáo?": "Lệ Thiên Hành",
        "Nhân vật chính trong phim 《Nam Đình Cốc Vi》 là ai?": "Cao Ảnh",
        "Cao Ảnh trong 《Nam Đình Cốc Vi》 học tại đại học nào?": "Học viện Mỹ thuật Giang Châu",
        "Ai là người dạy Tần Mục trong 《Mục Thần Ký》 đao pháp?": "B. Đồ tể",
        "Kỹ năng kết hợp nhiều dị hỏa cùng lúc của Tiêu Viêm trong 《Đấu Phá Thương Khung》 là gì?": "Phật Nộ Hỏa Liên",
        "Học viện đầu tiên mà Đường Tam theo học ở 《Đấu La Đại Lục》 là?": "C. Học viện Sử Lai Khắc",
        "Khôi lỗi Tiêu Viêm《Đấu Phá Thương Khung》 dùng thân thể của Địa Ma Lão Quỷ tạo thành": "Thiên Yêu Khôi",
        "Thân phận thật của lão đồ tể trong 《Mục Thần Ký》": "Thiên Đao",
        "\"Đấu Khí Hóa Dực\" là đặc trưng của cấp bậc nào trong 《Đấu Phá Thương Khung》?": "B. Đấu Vương",
        "Võ hồn của Ninh Vinh Vinh trong 《Đấu La Đại Lục》 là?": "B. Thất Bảo Lưu Ly Tháp",
        "Cao Ảnh trong 《Nam Đình Cốc Vi》 vô tình đánh thức ai?": "Dận Đình",
        "Dược sư trong 《Mục Thần Ký》 còn có danh xưng là gì?": "Ngọc Diện Độc Vương",
        "Thạch Mục là nhân vật chính trong phim hoạt hình nào?": "Huyền Giới Chi Môn",
        "Vị biểu ca bị phế linh hải của Vân Thanh Nam trong 《Tiên Đế Trở Về》": "Vân Hiên",
        "Phong Hi trong Phàm Nhân Tu Tiên là yêu thú cấp mấy?": "9",
        "Thiên hỏa đầu tiên Vân Thanh Nham trong 《Tiên Đế Trở Về》 đã thu phục khi trở về": "Thanh Liên địa tâm hỏa",
        "Biệt danh của Đái Mộc Bạch trong 《Đấu La Đại Lục》 là?": "B. Tà Mâu Bạch Hổ",
        "Ai là người bảo vệ Hải Thần Đảo trong 《Đấu La Đại Lục》?": "C. Ba Tái Tây",
        "Klein trong 《Quỷ Bí Chi Chủ》 vô tình bước vào con đường phi phàm thông qua?": "B. Nghi thức cầu nguyện",
        "Ôn Thiên Nhân trong Phàm Nhân Tu Tiên tu luyện công pháp gì?": "Lục Cực Chân Ma Công",
        "Vân Thanh Nham là nhân vật chính trong phim nào?": "Tiên Đế Trở Về",
        "Linh Dục Tú trong 《Mục Thần Ký》 gặp mặt Tần Mục lần đầu tiên với thân phận nào?": "Thất công tử",
        "Nhân vật \"Tiểu Y Tiên\" trong 《Đấu Phá Thương Khung》 chuyên về lĩnh vực gì?": "D. Độc thuật",
        "Các cảnh giới sau đây, đâu là cảnh giới đầu tiên trong các bộ phim hoạt hình Trung Quốc?": "C. Linh Thai",
        "Võ hồn của Cổ Dung trong 《Đấu La Đại Lục》 là gì?": "B. Cốt Long",
        "Tần Mục sinh ra ở đâu?": "Vô Ưu Hương",
        "Thân phận thật của Tư bà bà - Tư Ấu U trong 《Mục Thần Ký》": "Thiên Ma giáo thánh nữ",
        "Tiêu Viêm trong 《Đấu Phá Thương Khung》 từng nhận danh hiệu gì tại \"Luyện Đan Sư Đại Hội\"?": "Quán quân",
        "Danh hiệu của Vân thanh nam trong Tiên Đế Trở Về khi còn ở tiên giới": "Vân đế",
        "Môn phái đầu tiên Vương Lâm gia nhập là?": "Hằng Nhạc Phái",
        "Nhân vật \"Nạp Lan Yên Nhiên\" quan hệ với Tiêu Viêm là gì?": "Vợ chưa cưới",
        "Tư ẤU U trong《Mục Thần Ký》có quan hệ gì với Lệ Thiên Hành": "Vợ Chồng",
        "Hồn hoàn thứ nhất của Đường Tam trong 《Đấu La Đại Lục》 được săn bắn từ con hồn thú nào?": "B. Nhân Diện Ma Chu",
        "Áo Tư Tạp trong 《Đấu La Đại Lục》 thuộc hệ hồn sư nào?": "C. Phụ trợ hệ",
        "Nhân vật chính của Quỷ Bí Chi Chủ là ai?": "C. Klein Moretti",
        "Bảo vật Tư bà bà trong 《Mục Thần Ký》 để lại cho Tần Mục khi lên ngôi giáo chủ": "Sơn Hải Kinh",
        "Quốc gia phàm nhân nơi Vương Lâm trong 《Tiên Nghịch》 sinh ra là?": "B. Chu Quốc",
        "Tiêu Viêm gia nhập tông môn nào đầu tiên?": "Vân Lam Tông"
    };

    // ============================================================================
    // TASK IMPLEMENTATIONS
    // ============================================================================
    const TASKS = {
        async checkin() {
            const pageUrl = BASE_URL + "/diem-danh";
            const apiUrl = BASE_URL + "/wp-json/hh3d/v1/action";
            try {
            const res = await queueFetch(pageUrl, {headers: { "accept": "text/html"}});
            const html = await res.text();
            const _403 = handle403Response(res);
            if (_403) return _403;
            
            const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
            if (!isLogged) {
                return formatResult("checkin", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
            }
            
            const wpNonce = extractWpRestNonce(html);
            if (!wpNonce) {
                return formatResult("checkin", { status:"warning", nextTime:10000, message:"❌ Không tìm thấy restNonce" });
            }
            
            const res2 = await queueFetch(apiUrl, {
                method: "POST",
                headers: {
                "content-type": "application/json",
                "x-requested-with": "XMLHttpRequest",
                "x-wp-nonce": wpNonce,
                "referer": pageUrl,
                },
                body: JSON.stringify({ action: "daily_check_in" })
            });
            
            const data = await res2.json().catch(()=>null);
            const ok = data?.success || data?.message?.includes("đã điểm danh");
            
            return formatResult("checkin", {
                status: ok ? "done" : "warning",
                percent: ok ? 100 : 0,
                nextTime: ok ? 24*60*60*1000 : 10000,
                message: data?.message || "❌ Lỗi",
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
            });
            } catch (err) {
            return formatResult("checkin", { status:"error", nextTime:120000, message:`❌ ${err.message}` });
            }
        },

        async phucloi() {
            const pageUrl = BASE_URL + "/phuc-loi-duong?t=" + Date.now();
            const ajaxUrl = BASE_URL + "/wp-content/themes/halimmovies-child/hh3d-ajax.php";
            try {
            const res = await queueFetch(pageUrl, {headers: { "accept": "text/html"}});
            const html = await res.text();
            const _403 = handle403Response(res);
            if (_403) return _403;
            
            const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
            if (!isLogged) {
                return formatResult("phucloi", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
            }
                
            const secTokens = extractSecurityToken(html);
            
            if (!secTokens) {
                return formatResult("phucloi", { status:"warning", nextTime:10000, message:"❌ Không tìm thấy securityToken" });
            }
            
            const postHeaders = { 
                "accept": "application/json",
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8", 
                "x-requested-with": "XMLHttpRequest", 
                "referer": pageUrl,
            };
            
            const nextRes = await queueFetch(ajaxUrl, {
                method: "POST",
                headers: postHeaders,
                body: `action=get_next_time_pl&security_token=${encodeURIComponent(secTokens)}`
            });
            
            const nextJson = await nextRes.json().catch(()=>null);
            if (!nextJson?.success) {
                return formatResult("phucloi", { status:"warning", nextTime:10000, message:"❌ API lỗi" });
            }
            
            const timeStr = nextJson.data?.time;
            const chest_level = parseInt(nextJson.data?.chest_level || "0", 10);
            
            if (chest_level >= 4) {
                return formatResult("phucloi", { status:"done", percent:100, nextTime:24*60*60*1000, message:"🎉 Đủ 4 rương" });
            }
            
            const chest_id = chest_level + 1;
            
            if (timeStr?.trim() === "00:00") {
                await wait(1000);
                const openRes = await queueFetch(ajaxUrl, {
                method: "POST",
                headers: postHeaders,
                body: `action=open_chest_pl&security_token=${encodeURIComponent(secTokens)}&chest_id=${chest_id}`
                });
                
                const openJson = await openRes.json().catch(()=>null);
                if (openJson?.success) {
                return formatResult("phucloi", {
                    status: "success",
                    percent: (chest_id/4)*100,
                    nextTime: 5*60*1000,
                    message: `✅ Mở rương ${chest_id}/4`,
                    data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
                });
                }
            }
            
            return formatResult("phucloi", {
                status: "pending",
                percent: (chest_level/4)*100,
                nextTime: convertCountdownToMs(timeStr) || 60000,
                message: `⌛ Chờ ${timeStr} (${chest_level}/4)`,
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
            });
            } catch (err) {
            return formatResult("phucloi", { status:"error", nextTime:120000, message:`❌ ${err.message}` });
            }
        },

        async tele() {
            const pageUrl = BASE_URL + "/danh-sach-thanh-vien-tong-mon";
            const apiUrl = BASE_URL + "/wp-json/tong-mon/v1/te-le-tong-mon";
            try {
            const res = await queueFetch(pageUrl, {headers: {"accept": "text/html"}});
            const html = await res.text();
            const _403 = handle403Response(res);
            if (_403) return _403;
            
            const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
            if (!isLogged) {
                return formatResult("tele", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
            }
            
            const wpNonce = extractWpRestNonce(html);
            const securityToken = extractSecurityToken(html);
            if (!wpNonce || !securityToken) {
                return formatResult("tele", { status:"warning", nextTime:60000, message:"❌ Không tìm thấy token" });
            }
            
            await wait(1000);
            const res2 = await queueFetch(apiUrl, {
                method: "POST",
                headers: {
                    "accept": "application/json, text/javascript, */*;q=0.01",
                    "content-type": "application/json",
                    "x-requested-with": "XMLHttpRequest",
                    "x-wp-nonce": wpNonce,
                    "referer": pageUrl,
                },
                
                body: JSON.stringify({ action: "te_le_tong_mon", security_token: securityToken })
            });
            
            const data = await res2.json().catch(()=>null);
            const ok = data?.success || data?.message?.includes("đã Tế Lễ");
            
            return formatResult("tele", {
                status: ok ? "done" : "warning",
                percent: ok ? 100 : 0,
                nextTime: ok ? 24*60*60*1000 : 10000,
                message: data?.message || "❌ Lỗi",
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
            });
            } catch (err) {
            return formatResult("tele", { status:"error", nextTime:120000, message:`❌ ${err.message}` });
            }
        },

        async thiluyen() {
            const pageUrl = BASE_URL + "/thi-luyen-tong-mon-hh3d";
            const apiUrl = BASE_URL + "/wp-content/themes/halimmovies-child/hh3d-ajax.php";
            try {
                const res = await queueFetch(pageUrl, {headers: {"accept": "text/html"}});
                const html = await res.text();
                const _403 = handle403Response(res);
                if (_403) return _403;
                
                const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
                if (!isLogged) {
                return formatResult("thiluyen", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
                }
                
                const securityToken = extractSecurityToken(html);

                if (!securityToken) {
                return formatResult("thiluyen", { status:"warning", nextTime:10000, message:"❌ Không tìm thấy securityToken" });
                }
                
                const postHeaders = { 
                    "accept": "application/json",
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8", 
                    "x-requested-with": "XMLHttpRequest", 
                    "referer": pageUrl,
                };
                
                await wait(1000);
                const res2 = await queueFetch(apiUrl, {
                    method: "POST",
                    headers: postHeaders,
                    body: `action=get_remaining_time_tltm&security_token=${encodeURIComponent(securityToken)}`
                });
                
                const nextJson = await res2.json().catch(()=>null);
                if (!nextJson?.success) {
                    return formatResult("thiluyen", { status:"warning", nextTime:10000, message:"❌ API lỗi" });
                }
                
                const timeStr = nextJson?.data?.time_remaining;
                
                if (timeStr?.trim() === "00:00") {
                    const res3 = await queueFetch(apiUrl, {
                    method: "POST",
                    headers: postHeaders,
                    body: `action=open_chest_tltm&security_token=${encodeURIComponent(securityToken)}`
                    });
                    
                    const data = await res3.json().catch(()=>null);
                    if(data?.data?.message?.includes("Đã hoàn thành")) {
                        return formatResult("thiluyen", { status:"done", percent:100, nextTime:24*60*60*1000, message:"🎉 " + data.data.message });
                    } else {
                        const res4 = await queueFetch(apiUrl, {
                            method: "POST",
                            headers: postHeaders,
                            body: `action=get_remaining_time_tltm&security_token=${encodeURIComponent(securityToken)}`
                        });
                        const nextJson2 = await res4.json().catch(()=>null);
                        const timeStr2 = nextJson2?.data?.time_remaining;
                        return formatResult("thiluyen", {
                            status: "success",
                            percent: 50,
                            nextTime: convertCountdownToMs(timeStr2) || 10000,
                            message: data?.data?.message || JSON.stringify(data?.data) || "⚠️ Không xác định",
                        });				
                    }
                }
                
                return formatResult("thiluyen", {
                    status: "pending",
                    percent: 50,
                    nextTime: convertCountdownToMs(timeStr) || 60000,
                    message: `⌛ Chờ ${timeStr}`,
                    data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
                });
            } catch (err) {
            return formatResult("thiluyen", { status:"error", nextTime:120000, message:`❌ ${err.message}` });
            }
        },

        // ⭐ HOANG VỰC
        async hoangvuc(params) {
            let { buyChest = false, changeNguhanh = 0 } = params || {};
            changeNguhanh = parseInt(changeNguhanh) || 0;
            const pageUrl = BASE_URL + "/hoang-vuc?t="+ Date.now();
            const apiUrl  = BASE_URL + "/wp-content/themes/halimmovies-child/hh3d-ajax.php";
            const apiRewardUrl  = BASE_URL + "/wp-admin/admin-ajax.php";
            try {
            //lấy nonce ở html
            const res2 = await queueFetch(pageUrl, {
                headers: {
                "accept": "text/html",
                }
            });
            const html = await res2.text();
            const _403 = handle403Response(res2, "hoangvuc");
            if (_403) return _403;
            const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
            
            // Kiểm tra trạng thái đăng nhập
            if (!isLogged) {
                return formatResult("hoangvuc", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
            }
            
            const nonce = getNonce(html, "ajax_boss_nonce");
            const securityToken = extractSecurityToken(html);
            if(buyChest) {
                const buyChestRes =  await queueFetch(apiUrl, {
                method: "POST",
                headers: {
                    "accept": "application/json, text/javascript, */*;q=0.01",
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "x-requested-with": "XMLHttpRequest",
                    "referer": pageUrl,
                },
                body: `action=purchase_item_shop_boss&item_id=ruong_linh_bao&item_type=tinh_thach&quantity=5&nonce=${nonce}`,
                });
                const buyChestJson = await buyChestRes.json().catch(()=>null);
                if(buyChestJson?.success) {
                console.log("hoangvuc", `🛒 Mua rương linh bảo thành công: ${buyChestJson?.data?.message || buyChestJson?.message || "Thành công"}`);
                } else {
                console.log("hoangvuc", `❌ Mua rương linh bảo thất bại: ${buyChestJson?.data?.message || buyChestJson?.message || "Thất bại"}`);
                }
            }
            // Lấy ngũ hành người dùng
            const nguHanh = extractUserNguHanh(html);
            const remainingAttacks = extractRemainingAttacks(html) || 0;
            console.log("hoangvuc", `⚡ Ngũ hành người dùng: ${nguHanh || "Không xác định"}`);
            console.log("hoangvuc", `⚡ Lượt đánh còn lại: ${remainingAttacks}`);

            let percent = 0;
            percent = Math.round(((5 - remainingAttacks) / 5) * 100) || 0;
            const elements = {
                'kim': {'khac': 'moc', 'bi_khac': 'hoa'},  // Kim khắc Mộc, bị Hỏa khắc
                'moc': {'khac': 'tho', 'bi_khac': 'kim'},  // Mộc khắc Thổ, bị Kim khắc  
                'thuy': {'khac': 'hoa', 'bi_khac': 'tho'}, // Thủy khắc Hỏa, bị Thổ khắc
                'hoa': {'khac': 'kim', 'bi_khac': 'thuy'}, // Hỏa khắc Kim, bị Thủy khắc
                'tho': {'khac': 'thuy', 'bi_khac': 'moc'}  // Thổ khắc Thủy, bị Mộc khắc
            };

            // lấy thời gian đánh boss tiếp theo   
            // headers chung cho POST 
            const postHeaders = { 
                "accept": "application/json, text/javascript, */*;q=0.01",
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8", 
                "x-requested-with": "XMLHttpRequest", 
                "referer": pageUrl,
            };
            // check nhận thưởng đầu tiên
            const restReward = await queueFetch(apiRewardUrl, {
                method: "POST",
                headers: postHeaders,
                body: `action=claim_chest&nonce=${nonce}`
            });
            const rewardJson = await restReward.json().catch(()=>null);
            if(rewardJson?.success && rewardJson?.success.includes("Phần thưởng đã được nhận")) {
                // Format rewards từ object thành array các strings
                const rewards = rewardJson?.total_rewards || {};
                const formattedRewards = Object.entries(rewards)
                .filter(([_, value]) => value > 0) // Chỉ lấy những phần thưởng > 0
                .map(([key, value]) => {
                    const name = {
                    'tinh_thach': 'Tinh Thạch',
                    'tu_vi': 'Tu Vi', 
                    'tinh_huyet': 'Tinh Huyết',
                    'tien_ngoc': 'Tiên Ngọc'
                    }[key] || key;
                    return `- ${value} ${name}`; 
                })
                .join('\n');

                console.log("hoangvuc", `🎉 Nhận thưởng:\n${formattedRewards}`);
                
                return formatResult("hoangvuc", { 
                status: "success", 
                nextTime: 10000, 
                percent: 100,
                message: `🎉 Phần thưởng đã nhận:\n${formattedRewards}`,
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
                });
            }
            await wait(300);
            const res = await queueFetch(apiUrl, {
                method: "POST",
                headers: postHeaders,
                body: `action=get_next_attack_time`
            });
            const nextJson = await res.json().catch(()=>null);
            if(nextJson?.success) {
                const time = nextJson?.data; // thời gian dạng timestamp
                const now = Date.now();
                if(time > now) {
                return formatResult("hoangvuc", { status:"success", percent, nextTime: time - now, message:`⌛ Chưa tới giờ đánh boss (${new Date(time).toLocaleString()})` });
                } else {
                // tới giờ đánh boss       
                var requestId = 'req_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                // lấy thông tin boss
                const res3 = await queueFetch(apiUrl, {
                    method: "POST",
                    headers: postHeaders,
                    body: `action=get_boss&nonce=${nonce}`
                });
                const dataBossJson = await res3.json().catch(()=>null);
                if(dataBossJson?.success) {
                    // kiểm tra có phải đổi ngũ hành không         
                    // Lấy ngũ hành của boss từ response
                    const bossNguHanh = dataBossJson.data?.element?.toLowerCase() || "";
                    const MAX_CHANGE_ATTEMPTS = 6;
                    let currentAttempt = 0;
                    let currentNguHanh = nguHanh?.toLowerCase() || "";
                    
                    // Lặp cho đến khi đổi được ngũ hành phù hợp hoặc hết số lần thử
                    while (currentAttempt < MAX_CHANGE_ATTEMPTS) {
                    let damage = 0;
                    // Kiểm tra tương khắc
                    if(bossNguHanh && currentNguHanh) {
                        if(elements[bossNguHanh]?.khac === currentNguHanh) {
                        damage = -15; // Boss khắc mình
                        } else if(elements[currentNguHanh]?.khac === bossNguHanh) {
                        damage = 15;  // Mình khắc boss
                        }
                    }

                    console.log("hoangvuc", `⚔️ Ngũ hành: ${currentNguHanh} vs ${bossNguHanh} (${damage}% sát thương)`);

                    // Kiểm tra điều kiện đổi ngũ hành
                    const needChange = (changeNguhanh === 0 && damage === -15) || 
                                        (changeNguhanh === 15 && damage !== 15);
                    if(!needChange) {
                        console.log("hoangvuc", `🚀 Ngũ hành hiện tại phù hợp, tiến hành tấn công boss`);
                        break;
                    }

                    if(currentAttempt >= MAX_CHANGE_ATTEMPTS - 1) {
                        console.log("hoangvuc", `⚠️ Đã thử đổi ngũ hành ${MAX_CHANGE_ATTEMPTS} lần nhưng không đạt yêu cầu`);
                        return formatResult("hoangvuc", {
                        status: "warning",
                        nextTime: 10000,
                        percent,
                        message: `⚠️ Đã thử đổi ngũ hành ${MAX_CHANGE_ATTEMPTS} lần không thành công`,
                        data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
                        });
                    }

                    // Đổi ngũ hành
                    currentAttempt++;
                    console.log("hoangvuc", `🔄 Thử đổi ngũ hành lần ${currentAttempt}/${MAX_CHANGE_ATTEMPTS}`);
                    
                    const resChange = await queueFetch(apiUrl, {
                        method: "POST",
                        headers: postHeaders,
                        body: `action=change_user_element&nonce=${nonce}`
                    });
                    
                    const changeJson = await resChange.json().catch(()=>null);
                    if(!changeJson?.success) {
                        console.log("hoangvuc", `❌ Đổi ngũ hành thất bại: ${changeJson?.message || "Lỗi"}`);
                        break;
                    }

                    // Cập nhật ngũ hành mới
                    currentNguHanh = changeJson?.data?.new_element?.toLowerCase() || currentNguHanh;
                    console.log("hoangvuc", `✅ Đã đổi sang ngũ hành: ${currentNguHanh}`);
                    await wait(1000);
                    }
                    console.log("hoangvuc", `⚔️ Ngũ hành: ${currentNguHanh} vs ${bossNguHanh}`);
                    var bossId = dataBossJson?.data?.id;
                    // tấn công boss
                    const res4 = await queueFetch(apiUrl, {
                    method: "POST",
                    headers: postHeaders,
                    body: `action=attack_boss&boss_id=${encodeURIComponent(bossId)}&security_token=${encodeURIComponent(securityToken)}&nonce=${encodeURIComponent(nonce)}&request_id=${encodeURIComponent(requestId)}`
                    });
                    const data = await res4.json().catch(()=>null);
                    if(data?.success) {
                    // const date = new Date().toISOString().slice(0,10);
                    // const key = "hoangvuc_" + date;
                    // localStorage.setItem(key, data?.data?.message || "");
                    // lấy thời gian đánh boss tiếp theo
                    await wait(1000);
                    const res = await queueFetch(apiUrl, {
                        method: "POST",
                        headers: postHeaders,
                        body: `action=get_next_attack_time`
                    });
                    const nextJson2 = await res.json().catch(()=>null);
                    const time = nextJson2?.data || Date.now() + 10000; // thời gian dạng timestamp
                    const nextTime = time - Date.now();            
                    return formatResult("hoangvuc", { 
                        status:"success", 
                        nextTime: nextTime || 10000, 
                        percent,
                        message:`✅ Đánh boss thành công: ` + (data?.data?.message || "") ,
                        data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
                    });
                    } else {
                    if(data?.data?.error?.includes("đã hết lượt")) {
                        return formatResult("hoangvuc", { 
                        status:"done", 
                        percent:100, 
                        nextTime:0, 
                        message:`🎉 ${data?.data?.error || "Đã hết lượt đánh boss hôm nay"}` ,
                        data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
                        });
                    }
                    return formatResult("hoangvuc", { 
                        status:"warning", 
                        nextTime:10000, 
                        percent,
                        message:`❌ Đánh boss thất bại: ` + (data?.message || "Thất bại") ,
                        data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
                    });
                    }
                } else {
                    return formatResult("hoangvuc", { 
                    status:"warning", 
                    nextTime:10000, 
                    percent,
                    message:`❌ Lấy thông tin boss thất bại` ,
                    data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
                    });
                }
                }
            } else {
                return formatResult("hoangvuc", { 
                status:"warning", 
                nextTime:10000, 
                percent,
                message:`❌ Lấy thời gian đánh boss tiếp theo thất bại` ,
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
                });
            } 
            } catch (err) { 
            if(err.message.includes("Unauthorized")) {
                return formatResult("hoangvuc", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập!" });
            }
            return formatResult("hoangvuc", { status:"warning", nextTime:120000, message:`❌ ${err.message}` });
            } 
        },

        async khoangmach(params) {
            const pageUrl = BASE_URL + "/khoang-mach?t="+ Date.now();
            const apiUrl  = BASE_URL + "/wp-content/themes/halimmovies-child/hh3d-ajax.php";
            try {
            // lấy thông số cài đặt trong params
            let {
                khoangmach_mode = "fullDay",
                khoangmach_mineType = "thuong",
                khoangmach_mineId = 0,
                pickupMode = "full",
                pickupInterval = 2,
                khoangmach_reward = "any",
                khoangmachSchedule = []
            } = params || {};
            
            // Parse các số từ string sang integer
            const parsedPickupInterval = parseInt(pickupInterval) || 2;
            console.log("khoangmach", `📋 Cài đặt ban đầu: mode=${khoangmach_mode}, mineType=${khoangmach_mineType}, mineId=${khoangmach_mineId}, reward=${khoangmach_reward}, pickup=${pickupMode}`);

            // ⭐ Kiểm tra chế độ lịch trình - tìm lịch gần nhất trước thời điểm hiện tại
            if (khoangmach_mode === "scheduled" && khoangmachSchedule.length > 0) {
                const now = new Date();
                const currentHour = now.getHours();
                const currentMinute = now.getMinutes();
                const currentTimeInMinutes = currentHour * 60 + currentMinute;

                // Chuyển đổi tất cả lịch trình thành phút từ 00:00
                const scheduleList = khoangmachSchedule.map(schedule => {
                const [scheduleHour, scheduleMinute] = schedule.time.split(':').map(Number);
                return {
                    ...schedule,
                    timeInMinutes: scheduleHour * 60 + scheduleMinute
                };
                }).sort((a, b) => a.timeInMinutes - b.timeInMinutes); // Sắp xếp theo thời gian

                // Tìm lịch trình gần nhất TRƯỚC thời điểm hiện tại
                let activeSchedule = null;
                
                // Tìm lịch cuối cùng có thời gian <= thời gian hiện tại
                for (let i = scheduleList.length - 1; i >= 0; i--) {
                if (scheduleList[i].timeInMinutes <= currentTimeInMinutes) {
                    activeSchedule = scheduleList[i];
                    break;
                }
                }
                
                // Nếu không tìm thấy (tức là thời gian hiện tại trước tất cả lịch trong ngày)
                // thì lấy lịch cuối cùng của ngày hôm trước
                if (!activeSchedule && scheduleList.length > 0) {
                activeSchedule = scheduleList[scheduleList.length - 1];
                console.log("khoangmach", `🕒 Chưa đến lịch đầu tiên hôm nay, sử dụng lịch cuối hôm qua: ${activeSchedule.time}`);
                }

                if (activeSchedule) {
                khoangmach_mineType = activeSchedule.mineType;
                khoangmach_mineId = parseInt(activeSchedule.mineId) || 0;
                console.log("khoangmach", `🕒 Áp dụng lịch ${activeSchedule.time}: Mỏ ${khoangmach_mineType} - ID ${khoangmach_mineId}`);
                } else {
                console.log("khoangmach", `⏰ Không có lịch trình nào được cài đặt`);
                return formatResult("khoangmach", {
                    status: "error",
                    percent: 0,
                    nextTime: 10000,
                    message: `❌ Không có lịch trình nào được cài đặt`
                });
                }
            }

            // load html để lấy security - dùng callWindowFetch
            const res = await fetchWithBypass(pageUrl, {
                headers: {
                "accept": "text/html"
                },
                acceptHtml: true //
            });
            // console.log('Response Status:', res.status);
            // console.log('Title :', res.title);
            const html = await res.text();
            // console.log('Response Body:', html.substring(0, 5000)); // In ra 500 ký tự đầu tiên của body để kiểm tra
            const _403 = handle403Response(res, "khoangmach");
            if (_403) return _403;
            const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
            
            // Kiểm tra trạng thái đăng nhập
            if (!isLogged) {
                return formatResult("khoangmach", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
            }
            
            const tokens = extractActionTokens(html);
            const securityToken = extractSecurityToken(html);
            if (!securityToken) {
                return formatResult("khoangmach", { status: "warning", nextTime: 60000, message: "❌ Không tìm thấy securityToken" });
            }
            const security_load = tokens["load_mines_by_type"];
            const security_get_users = tokens["get_users_in_mine"];
            const security_enter = tokens["enter_mine"];
            const security_claim = tokens["claim_mycred_reward"];
            const security_claim_km = tokens["claim_reward_km"];
            const security_buy_item = tokens["buy_item_khoang"];
            const security_doat_mo = tokens["change_mine_owner"];
            
            const security_km = getNonce(html, "security_km");
            // ⭐ KHAI BÁO RA NGOÀI ĐỂ SỬ DỤNG ĐƯỢC Ở PHẦN DƯỚI
            let percent = 0;
            let currentTuVi = 0;
            let maxTuVi = 0;
            
            // ⭐ SỬA: DÙNG DOMPARSER ĐỂ LẤY TU VI
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const tuViElement = doc.querySelector('.stat-item.stat-tuvi');
            const tuViText = tuViElement ? tuViElement.textContent : "";
            const tuViMatch = tuViText.match(/Tu Vi:\s*(\d+)\s*\/\s*(\d+)/i);

            const defeatElement = doc.querySelector('.stat-item.stat-defeat');
            const defeatText = defeatElement ? defeatElement.textContent : "";
            let defeatCount = 0;
            try {
                const mDef = defeatText.match(/(\d+)/);
                if (mDef) defeatCount = parseInt(String(mDef[1]).replace(/[^0-9]/g, '')) || 0;
            } catch (e) { defeatCount = 0; }
            console.log("khoangmach", `⚠️ Đã bị sát hại: ${defeatCount} lần`);
            
            if (tuViMatch) {
                currentTuVi = parseInt(tuViMatch[1]) || 0;
                maxTuVi = parseInt(tuViMatch[2]) || 0;
                percent = maxTuVi > 0 ? Math.round((currentTuVi * 100) / maxTuVi) : 0;
                
                console.log("khoangmach", `⚡ Tu Vi đã nhận: ${currentTuVi} / ${maxTuVi}`);      
                
                if (currentTuVi >= maxTuVi) {
                localStorage.setItem('khoangmach_completed', true);
                return formatResult("khoangmach", { 
                    status: "done", 
                    percent: 100, 
                    nextTime: 0, 
                    message: `🎉 Đã đào xong ${currentTuVi}/${maxTuVi}, không thể vào lại mỏ khoáng.`,
                    data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, defeatCount }
                });
                } else{
                localStorage.setItem('khoangmach_completed', false);
                }
            } else {
                return formatResult("khoangmach", { status: "warning", nextTime: 10000, message: "❌ Lỗi khi kiểm tra thông số..." });
            }
            
            // headers chung cho POST
            const postHeaders = {
                "accept": "application/json, text/javascript, */*;q=0.01",
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "x-requested-with": "XMLHttpRequest",
                "referer": pageUrl,
            };

            // kiểm tra có thưởng sau khi bị giết không
            const resKm = await queueFetch(apiUrl, {
                method: "POST",
                headers: postHeaders,
                body: `action=claim_reward_km&security_token=${encodeURIComponent(securityToken)}&security=${encodeURIComponent(security_claim_km)}`,
            });
            const kmJson = await resKm.json().catch(() => null);
            if(kmJson?.success) {
                const reward = kmJson?.data || {};
                // ⭐ Liệt kê hết tất cả thuộc tính trong reward
                const rewardEntries = Object.entries(reward);
                const rewardDetails = rewardEntries.map(([key, value]) => `${key}: ${value}`).join(", ");
                
                return formatResult("khoangmach", {
                status: "warning",
                nextTime: 30000,
                percent,
                message: `✅ Nhận thưởng sau khi bị giết: ${rewardDetails || "Không rõ"}`,
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, defeatCount }
                });
            } else{
                // console.log("khoangmach", `⚡Kiểm tra thưởng bị sát hại: ${kmJson?.data?.message || "Không tìm thấy thưởng để nhận"}`);
            }

            // load danh sách mỏ
            const mineTypeMap = { thuong: "gold", trung: "silver", ha: "copper" };
            const mineType = mineTypeMap[khoangmach_mineType] || "gold";
            const res2 = await queueFetch(apiUrl, {
                method: "POST",
                headers: postHeaders,
                body: `action=load_mines_by_type&mine_type=${mineType}&security=${encodeURIComponent(security_load)}`,
            });
            const mineJson = await res2.json().catch(() => null);
            if (!mineJson?.success) {
                return formatResult("khoangmach", { status: "warning", nextTime: 60000, percent, message: "❌ Lấy danh sách mỏ thất bại" });
            } else{
                await wait(500);
                const mines = mineJson?.data || [];
                // kiểm tra có đang vào mỏ hay không
                const inMine = mines.find(m => m.is_current === true);
                if(inMine) {
                console.log("khoangmach", `🎉 Đang ở trong mỏ khoáng ${inMine.name}`);
                    if(pickupMode ==='interval2') {
                    if(currentTuVi >= maxTuVi * 0.9) {
                    return formatResult("khoangmach", { 
                        status: "warning", 
                        nextTime: parseInt(pickupInterval) * 60000,
                        percent,
                        message: `🎉 Đã đào được ${currentTuVi}/${maxTuVi} Tu Vi (>=90%), không nhận thưởng tiếp.`,
                        data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, defeatCount }
                    });
                    }
                }
                if(inMine.id === khoangmach_mineId) {
                    await wait(200);
                    const resLoad = await queueFetch(apiUrl, {
                    method: "POST",
                    headers: postHeaders,
                    body: `action=get_users_in_mine&mine_id=${inMine.id}&security_token=${encodeURIComponent(securityToken)}&security=${encodeURIComponent(security_get_users)}`,
                    });
                    const loadUserJson = await resLoad.json().catch(() => null);
                    if(loadUserJson?.success) {
                    const users = loadUserJson?.data?.users || [];
                    let bonus_percentage = loadUserJson?.data?.bonus_percentage || 0;
                    console.log("khoangmach", ` 🎉 Có ${users.length} người trong mỏ khoáng và có ${bonus_percentage}% thưởng thêm`);
                
                    const myUser = users.find(u => String(u.id) === String(profileId));
                    if(myUser) {
                        const time_spent = myUser.time_spent || "Không rõ";
                        console.log("khoangmach", ` 🎉 Đã ở trong mỏ khoáng được: ${time_spent}`);
                        
                        // ⭐ Parse time_spent để lấy số giây chính xác (bao gồm cả phút và giây)
                        let timeSpentSeconds = 0;
                        const isMaxTime = time_spent === "Đạt tối đa";
                        if (!isMaxTime) {
                        // Parse cả phút và giây: "25 phút 30 giây" hoặc "5 phút"
                        const minuteMatch = time_spent.match(/(\d+)\s*phút/);
                        const secondMatch = time_spent.match(/(\d+)\s*giây/);
                        
                        const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
                        const seconds = secondMatch ? parseInt(secondMatch[1]) : 0;
                        
                        timeSpentSeconds = minutes * 60 + seconds;
                        console.log("khoangmach", ` 🕐 Đã ở ${minutes} phút ${seconds} giây = ${timeSpentSeconds} giây`);
                        }
                        
                        // ⭐ Kiểm tra điều kiện nhận thưởng theo mode
                        let shouldProceed = false;
                        let waitMessage = "";
                        let nextCheckTime = parseInt(pickupInterval) * 60 * 1000; // mặc định
                        
                        if (pickupMode === "full") {
                        shouldProceed = isMaxTime;
                        if (!shouldProceed) {
                            waitMessage = `Chưa đạt tối đa (${time_spent})`;
                            // Kiểm tra lại sau pickupInterval phút
                        }
                        } else if (pickupMode === "interval") {
                        const requiredSeconds = parseInt(pickupInterval) * 60; // Chuyển phút sang giây
                        shouldProceed = isMaxTime || timeSpentSeconds >= requiredSeconds;
                        if (!shouldProceed) {
                            const remainingSeconds = requiredSeconds - timeSpentSeconds;
                            const remainingMinutes = Math.ceil(remainingSeconds / 60); // Cho hiển thị
                            waitMessage = `Chưa đủ ${parseInt(pickupInterval)} phút (hiện tại: ${time_spent}, còn ${remainingSeconds}s)`;
                            // ⭐ nextCheckTime tính chính xác theo giây còn lại
                            nextCheckTime = remainingSeconds * 1000;
                            console.log("khoangmach", ` 🕐 nextCheckTime = ${remainingSeconds}s = ${nextCheckTime}ms`);
                        }
                        } else if (pickupMode === "interval2") {
                        shouldProceed = true; // Mode này luôn chạy để kiểm tra 90%
                        }
                        
                        if(!shouldProceed) {
                        console.log("khoangmach", ` ⚠️ ${waitMessage}`);
                        return formatResult("khoangmach", { 
                            status: "success", 
                            nextTime: nextCheckTime, 
                            percent,
                            message: `⚠️ ${waitMessage}`,
                            data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, defeatCount }
                        });
                        }
                        
                        if(shouldProceed) {
                        if (khoangmach_reward === "manual") {
                            console.log("khoangmach", ` ⚠️ Chế độ thủ công — không nhận thưởng.`);
                            return formatResult("khoangmach", { 
                            status: "warning", 
                            nextTime: parseInt(pickupInterval) * 60 * 1000, 
                            percent,
                            message: `⚠️ Chế độ thủ công — không nhận thưởng.`,
                            data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, defeatCount }
                            });
                        }

                        if(khoangmach_reward === "110" && bonus_percentage >= 50 && bonus_percentage < 110) {
                            // ⭐ KIỂM TRA LOCK MỎ TRƯỚC KHI ĐOẠT
                            const lockStatus = isMineLocked(inMine.id);
                            if (lockStatus && lockStatus.locked) {
                            console.log("khoangmach", `⏳ Mỏ ${inMine.id} đang được xử lý (còn ${lockStatus.remainingTime}s), chờ 5s...`);
                            return formatResult("khoangmach", { 
                                status: "warning", 
                                nextTime: 5000, // ⭐ CHẠY LẠI SAU 5 GIÂY
                                percent,
                                message: `⏳ Mỏ đang được xử lý, chờ ${lockStatus.remainingTime}s...`,
                                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
                            });
                            }

                            // ⭐ KHÓA MỎ TRƯỚC KHI XỬ LÝ
                            lockMine(inMine.id);

                            try {
                            // đoạt mỏ rồi kiểm tra mức thưởng
                            const doatRes = await queueFetch(apiUrl, {
                                method: "POST",
                                headers: postHeaders,
                                body: `action=change_mine_owner&mine_id=${inMine.id}&security=${encodeURIComponent(security_doat_mo)}`,
                                useWindowFetch: false // Force dùng sessionFetch cho API
                            });
                            const doatJson = await doatRes.json().catch(() => null);
                            if (doatJson?.success) {
                                console.log("khoangmach", `✅ Đoạt mỏ thành công: ${doatJson?.data?.message || "Thành công"}`);
                            } else {
                                console.log("khoangmach", `❌ Đoạt mỏ thất bại: ${doatJson?.data?.message || "Thất bại"}`);
                                // ⭐ MỞ KHÓA KHI THẤT BẠI
                                unlockMine(inMine.id);
                                return formatResult("khoangmach", { 
                                status: "warning", 
                                nextTime: 10000, 
                                percent,
                                message: `❌ Đoạt mỏ thất bại: ${doatJson?.data?.message || "Thất bại"}`,
                                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, defeatCount }
                                });
                            }

                            await wait(1000);
                            const resLoad2 = await queueFetch(apiUrl, {
                                method: "POST",
                                headers: postHeaders,
                                body: `action=get_users_in_mine&mine_id=${inMine.id}&security_token=${encodeURIComponent(securityToken)}&security=${encodeURIComponent(security_get_users)}`,
                                useWindowFetch: false // Force dùng sessionFetch cho API
                            });
                            const loadUserJson = await resLoad2.json().catch(() => null);
                            if(loadUserJson?.success) {
                                const users = loadUserJson?.data?.users || [];
                                bonus_percentage = loadUserJson?.data?.bonus_percentage || 0;
                                console.log("khoangmach", ` 🎉 Sau khi đoạt mỏ, có ${users.length} người trong mỏ khoáng và có ${bonus_percentage}% thưởng thêm`);

                                if(bonus_percentage < 110 && bonus_percentage >= 50) {
                                // mua bùa buff
                                console.log("khoangmach", ` 🛒 Đang mua bùa buff thưởng 110%...`);
                                const itemId = 4; // ID của bùa buff linh quang phù
                                // Gửi request mua item
                                const buyRes = await queueFetch(apiUrl, {
                                    method: "POST",
                                    headers: postHeaders,
                                    body: `action=buy_item_khoang&security=${encodeURIComponent(security_buy_item)}&item_id=${itemId}`,
                                    useWindowFetch: false // Force dùng sessionFetch cho API
                                });
                                const buyJson = await buyRes.json().catch(() => null);
                                if (buyJson?.success) {
                                    console.log("khoangmach", `✅ Mua bùa buff thành công: ${buyJson?.data?.message || "Thành công"}`);
                                    bonus_percentage = 110;
                                } else {
                                    console.log("khoangmach", `❌ Mua bùa buff thất bại: ${buyJson?.data?.message || "Thất bại"}`);
                                }
                                }                    
                            }
                            
                            // ⭐ NOTE: MỞ KHÓA SAU KHI CLAIM (Ở DƯỚI)
                            } catch (error) {
                            // ⭐ MỞ KHÓA KHI CÓ LỖI
                            unlockMine(inMine.id);
                            console.log("khoangmach", `❌ Lỗi khi xử lý đoạt mỏ: ${error.message}`);
                            throw error;
                            }             
                        }
                        const shouldClaim =
                            (khoangmach_reward === "any") ||
                            (khoangmach_reward === "110" && bonus_percentage >= 110) ||
                            (khoangmach_reward === "100" && bonus_percentage >= 100) ||
                            (khoangmach_reward === "50" && bonus_percentage >= 50) ||
                            (khoangmach_reward === "20" && bonus_percentage >= 20);
                        if (shouldClaim) {
                            console.log("khoangmach", ` 🎉 Đang nhận thưởng ${bonus_percentage}%...`);
                            const resClaim = await queueFetch(apiUrl, {
                            method: "POST",
                            headers: postHeaders,
                            body: `action=claim_mycred_reward&mine_id=${inMine.id}&security_token=${encodeURIComponent(securityToken)}&security=${encodeURIComponent(security_claim)}`,
                            useWindowFetch: false // Force dùng sessionFetch cho API
                            });
                            const claimJson = await resClaim.json().catch(() => null);
                            // ⭐ MỞ KHÓA SAU KHI CLAIM (THÀNH CÔNG HAY THẤT BẠI)
                            unlockMine(inMine.id);
                            if (claimJson?.success) {
                            return formatResult("khoangmach", { 
                                status: "success", 
                                nextTime: parseInt(pickupInterval) * 60 * 1000, 
                                percent,
                                message: `✅ Nhận thưởng thành công: ${claimJson?.data?.message || ""}`,
                                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, defeatCount }
                            });
                            } else {
                            console.log("khoangmach", ` ❌ Nhận thưởng thất bại: ${claimJson?.data?.message || claimJson?.data || "Thất bại"}`);
                            return formatResult("khoangmach", { status: "warning", percent, nextTime: 10000, message: `❌ Nhận thưởng thất bại: ${claimJson?.data?.message || claimJson?.data || "Thất bại"}` });
                            }
                        } else{
                            // ⭐ MỞ KHÓA NẾU KHÔNG CLAIM (chưa đủ điều kiện)
                            unlockMine(inMine.id);
                            console.log("khoangmach", ` ⚠️ Chưa đạt điều kiện nhận thưởng (${bonus_percentage}%)`);
                            return formatResult("khoangmach", { 
                            status: "warning", 
                            nextTime: parseInt(pickupInterval) * 60 * 1000, 
                            percent,
                            message: `⚠️ Chưa đạt điều kiện nhận thưởng (${bonus_percentage}%)`,
                            data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, defeatCount }
                            });
                        }
                        }
                    } else {
                        console.log("khoangmach", `❌ Không tìm thấy tôi trong mỏ khoáng đã chọn`);
                        return formatResult("khoangmach", { status: "warning", percent, nextTime: 20000 , message: `❌ Không tìm thấy tôi trong mỏ khoáng đã chọn`, data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, defeatCount } });
                    }
                    }
                }
                } else {
                // chưa vào mỏ, hoặc vào mỏ khác
                let selectedMine = null;
                if(khoangmach_mineId && khoangmach_mineId > 0) {
                    selectedMine = mines.find(m => m.id === khoangmach_mineId);
                    if(!selectedMine) {
                    console.log("khoangmach", `❌ Không tìm thấy mỏ khoáng ID=${khoangmach_mineId}`);
                    return formatResult("khoangmach", { status: "warning", percent: 0, nextTime: 30000, message: `❌ Không tìm thấy mỏ khoáng ID: ${khoangmach_mineId}`, data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, defeatCount } });
                    }          
                    
                    // vào mỏ đã chọn
                    console.log("khoangmach", `Vào mỏ khoáng đã chọn: ID:${selectedMine.id}, Tên: ${selectedMine.name}`);
                    const res3 = await queueFetch(apiUrl, {
                    method: "POST",
                    headers: postHeaders,
                    body: `action=enter_mine&mine_id=${selectedMine.id}&security_token=${encodeURIComponent(securityToken)}&security=${encodeURIComponent(security_enter)}&security_km=${encodeURIComponent(security_km)}`,
                    });
                    const enterJson = await res3.json().catch(() => null);
                    if (enterJson?.success) {
                    // vào mỏ thành công,
                    console.log("khoangmach", `✅ Vào mỏ khoáng thành công: ${selectedMine.name} (ID=${selectedMine.id})`);
                    return formatResult("khoangmach", { 
                        status: "success", 
                        nextTime: parseInt(pickupInterval) * 60 * 1000 , 
                        percent,
                        message: `✅ Vào mỏ khoáng thành công: ${selectedMine.name} (ID=${selectedMine.id})`,
                        data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, defeatCount }
                    });
                    } else{
                    if(enterJson?.data?.message?.includes("đã đạt đủ thưởng ngày")) {
                        console.log("khoangmach", `🎉 ${enterJson?.data?.message || "Đã hết lượt vào mỏ khoáng hôm nay"}`);
                        return formatResult("khoangmach", { 
                        status: "done", 
                        percent:100, 
                        nextTime:0, 
                        message:`🎉 ${enterJson?.data?.message || "Đã hết lượt vào mỏ khoáng hôm nay"}`,
                        data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
                        });
                    }
                    console.log("khoangmach", `❌ Vào mỏ khoáng thất bại: ${enterJson?.data?.message|| enterJson?.data || "Thất bại"}`);
                    return formatResult("khoangmach", { status: "warning", percent, nextTime: parseInt(pickupInterval) * 60 * 1000 , message: `❌ Vào mỏ khoáng thất bại: ${enterJson?.data?.message || enterJson?.data || "Thất bại"}` });
                    }
                } else {
                    console.log("khoangmach", `❌ Chưa cài đặt mỏ khoáng trong tham số (khoangmach_mineId=${khoangmach_mineId})`);
                    return formatResult("khoangmach", { status: "error", percent: 0, nextTime: 10000, message: `❌ Chưa cài đặt khoáng mạch` });
                }
                }
            }

            } catch (err) {
            if(err.message.includes("Unauthorized")) {
                return formatResult("khoangmach", { status:"error", percent: 0, nextTime:10000, message:"❌ Chưa đăng nhập!" });
            }
            return formatResult("khoangmach", { status:"warning", percent: 0, nextTime:60000, message:`❌ ${err.message}` });
            }
        },

        // ⭐ VẤN ĐÁP (Fully implemented with answer database)
        async vandap() {
            const pageUrl = BASE_URL + "/van-dap-tong-mon?t=" + Date.now();
            const apiUrl = BASE_URL + "/wp-content/themes/halimmovies-child/hh3d-ajax.php";
            try {
                const res = await queueFetch(pageUrl, {headers: {"accept": "text/html"}});
                const html = await res.text();
                const _403 = handle403Response(res);
                if (_403) return _403;
                
                const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
                if (!isLogged) return formatResult("vandap", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
                
                const securityToken = extractSecurityToken(html);
                if (!securityToken) return formatResult("vandap", { status:"warning", nextTime:10000, message:"❌ Không tìm thấy securityToken" });
                
                const postHeaders = {
                    "accept": "application/json",
                    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                    "x-requested-with": "XMLHttpRequest",
                    "referer": pageUrl,
                };
                
                // Load câu hỏi
                const resQuiz = await queueFetch(apiUrl, {
                    method: "POST",
                    headers: postHeaders,
                    body: `action=load_quiz_data&security_token=${encodeURIComponent(securityToken)}`
                });
                
                const quizJson = await resQuiz.json().catch(()=>null);
                if (!quizJson?.success) return formatResult("vandap", { status:"warning", nextTime:10000, message:"❌ Lấy câu hỏi thất bại" });
                
                if (quizJson?.data?.completed) {
                    return formatResult("vandap", { status:"done", percent:100, nextTime:0, message:"🎉 Đã hoàn thành vấn đáp hôm nay" });
                }
                const quizData = quizJson?.data || {};
                const questionResults = [];
                const correct_answers = quizData.correct_answers || 0;
                for(let i = correct_answers; i <= quizData.questions.length; i++) {
                    const question = quizData.questions[i];
                    if(!question) break;
                    const questionId = question.id;
                    const questionText = question.question;
                    const answers = question.options || [];
                    ( "vandap", `❓ Câu hỏi #${i+1}: ${questionText}`);
                    for(const ans of answers) {
                    console.log( "vandap", `   - ${ans}`);
                    }
                    // Tìm câu trả lời đúng
                    const normalizedQuestion = normalizeText(questionText);

                    // Tìm trong database toàn cục bằng cách so sánh chuẩn hóa
                    const correctAnswer = Object.entries(ANSWER_DATABASE).find(([q, a]) => {
                    const normalizedQ = normalizeText(q);
                    return normalizedQ === normalizedQuestion;
                    })?.[1];
                    if (!correctAnswer) {
                    console.log( "vandap", `❌ Không tìm thấy câu trả lời trong database`);
                    return formatResult("vandap", { 
                        status: "warning", 
                        nextTime: 10000, 
                        message: `❌ Không tìm thấy câu trả lời cho câu hỏi: ${questionText}` 
                    });
                    }

                    // Tìm đáp án trùng khớp
                    const selectedAnswer = answers.find(a => {
                    const normalizedAnswer = normalizeText(a);
                    const normalizedCorrect = normalizeText(correctAnswer);
                    return normalizedAnswer === normalizedCorrect;
                    });

                    if (!selectedAnswer) {
                    console.log( "vandap", `❌ Không tìm thấy đáp án phù hợp`);
                    console.log( "vandap", `   Đáp án cần tìm: ${correctAnswer}`);
                    return formatResult("vandap", {
                        status: "warning",
                        nextTime: 60000, 
                        message: `❌ Không tìm thấy đáp án phù hợp cho câu trả lời: ${correctAnswer}`
                    });
                    }

                    // Trả lời câu hỏi
                    console.log( "vandap", `✅ Đã tìm thấy câu trả lời: ${selectedAnswer}`);
                    const idAnswer = answers.indexOf(selectedAnswer);
                    const resAnswer = await queueFetch(apiUrl, {
                    method: "POST", 
                    headers: postHeaders,
                    body: `action=save_quiz_result&security_token=${securityToken}&answer=${idAnswer}&question_id=${questionId}`
                    });

                    const answerJson = await resAnswer.json().catch(() => null);
                    if (!answerJson?.success) {
                    console.log( "vandap", `❌ Trả lời câu hỏi thất bại: ${answerJson?.data?.message || answerJson?.data || "Thất bại"}`);
                    return formatResult("vandap", {
                        status: "warning",
                        nextTime: 10000,
                        message: `❌ Trả lời câu hỏi thất bại: ${answerJson?.data?.message || answerJson?.data || "Thất bại"}`
                    });
                    }
                    const date = new Date().toISOString().slice(0,10);
                    const key = "vandap_" + date;
                    const questionSaved = `❓ Câu hỏi #${i+1}: ${questionText}`;
                    const answerSaved = `✅ Đáp án: ${selectedAnswer}`;
                    questionResults.push(`${questionSaved}\n${answerSaved}`); // ⭐ Thêm vào mảng

                    // Kiểm tra kết quả
                    if (answerJson.data?.is_correct === 1) {
                    console.log( "vandap", `🎉 ${answerJson.data?.message}`);
                    }
                    // Tiếp tục câu tiếp theo
                    await wait(1000);        
                }		

                const resLoadQuiz2 = await queueFetch(apiUrl, {
                    method: "POST", 
                    headers: postHeaders,
                    body: "action=load_quiz_data&security_token=" + encodeURIComponent(securityToken)
                });

                const loadJson = await resLoadQuiz2.json().catch(() => null);
                if(!loadJson?.success) {
                    return formatResult("vandap", { status: "warning", nextTime: 10000, message: "❌ Lấy kết quả thất bại: " + (loadJson?.data?.message || loadJson?.data || "Thất bại") });
                } else if(loadJson.data?.completed) {
                    console.log( "vandap", `🎉 Đã trả lời hết ${loadJson.data?.correct_answers} câu hỏi.`);
                    return formatResult("vandap", { 
                    status: "done", percent:100, nextTime:0, message: "🎉 Đã hoàn thành vấn đáp hôm nay",
                    data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
                    });
                }
            } catch (err) {
            return formatResult("vandap", { status:"error", nextTime:120000, message:`❌ ${err.message}` });
            }
        },

        // ⭐ LUẬN VÕ (Implemented với settings)
        async luanvo() {
            const pageUrl = BASE_URL + "/luan-vo?t=" + Date.now();
            const apiUrl = BASE_URL + "/wp-json/luan-vo/v1/send-challenge";
            const apiAcceptUrl = BASE_URL + "/wp-json/luan-vo/v1/auto-accept";
            
            // Load settings from storage
            const settings = await new Promise(resolve => {
            safeStorageGet(['luanvo_mode', 'luanvo_targetId', 'luanvo_hireBot'], resolve);
            });
            
            const mode = settings.luanvo_mode || 'auto';
            const targetId = settings.luanvo_targetId || '';
            const hireBot = settings.luanvo_hireBot || false;
            
            try {
            const res = await queueFetch(pageUrl, {headers: {"accept": "text/html"}});
            const html = await res.text();
            const _403 = handle403Response(res);
            if (_403) return _403;
            
            const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
            if (!isLogged) return formatResult("luanvo", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
            
            const wpNonce = extractWpRestNonce(html);
            if (!wpNonce) return formatResult("luanvo", { status:"warning", nextTime:10000, message:"❌ Không tìm thấy nonce" });
            
            // Extract challenge counts
            const sentMatch = html.match(/so-luot-gui[^>]*>.*?(\d+)\s*\/\s*(\d+)/i);
            const receivedMatch = html.match(/so-luot-nhan[^>]*>.*?(\d+)\s*\/\s*(\d+)/i);
            
            const sentCount = sentMatch ? parseInt(sentMatch[1], 10) : 0;
            const sentTotal = sentMatch ? parseInt(sentMatch[2], 10) : 5;
            const receivedCount = receivedMatch ? parseInt(receivedMatch[1], 10) : 0;
            const receivedTotal = receivedMatch ? parseInt(receivedMatch[2], 10) : 5;
            
            if (sentCount >= sentTotal && receivedCount >= receivedTotal) {
                return formatResult("luanvo", { status:"done", percent:100, nextTime:0, message:"🎉 Đã đạt tối đa gửi và nhận" });
            }
            
            const postHeaders = {
                "accept": "application/json",
                "content-type": "application/json",
                "x-requested-with": "XMLHttpRequest",
                "x-wp-nonce": wpNonce,
                "referer": pageUrl,
            };
            
            let messages = [];
            
            // Send challenge
            if (sentCount < sentTotal) {
                let targetUserId = targetId;
                if (mode === 'auto' || !targetUserId) {
                // Random target (simplified - should fetch online users)
                targetUserId = '1'; // Placeholder
                }
                
                const resChallenge = await queueFetch(apiUrl, {
                method: "POST",
                headers: postHeaders,
                body: JSON.stringify({ target_user_id: targetUserId })
                });
                
                const challengeJson = await resChallenge.json().catch(()=>null);
                if (challengeJson?.success) {
                const challengeId = challengeJson?.data?.challenge_id;
                messages.push(`✅ Gửi khiêu chiến thành công`);
                
                // Auto accept
                await wait(2000);
                const resAccept = await queueFetch(apiAcceptUrl, {
                    method: "POST",
                    headers: postHeaders,
                    body: JSON.stringify({ challenge_id: challengeId })
                });
                
                const acceptJson = await resAccept.json().catch(()=>null);
                if (acceptJson?.success) {
                    messages.push(`✅ Tự động chấp nhận thành công`);
                }
                } else {
                messages.push(`❌ ${challengeJson?.message || 'Gửi khiêu chiến thất bại'}`);
                }
            }
            
            return formatResult("luanvo", {
                status:"success",
                percent: Math.floor(((sentCount + receivedCount) / (sentTotal + receivedTotal)) * 100),
                nextTime: 5*60*1000,
                message: messages.join('\n') || `📊 Gửi: ${sentCount}/${sentTotal}, Nhận: ${receivedCount}/${receivedTotal}`,
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
            });
            } catch (err) {
            return formatResult("luanvo", { status:"error", nextTime:120000, message:`❌ ${err.message}` });
            }
        },

        // ⭐ FETCH MINE DATA - Lấy danh sách mỏ thượng, trung, hạ
        async fetchMineData() {
            const pageUrl = BASE_URL + "/khoang-mach?t="+ Date.now();
            const apiUrl  = BASE_URL + "/wp-content/themes/halimmovies-child/hh3d-ajax.php";
            
            try {
            // Load HTML để lấy security tokens
            const res = await fetchWithBypass(pageUrl, {
                headers: { "accept": "text/html" },
                acceptHtml: true
            });
            const html = await res.text();
            const _403 = handle403Response(res, "fetchMineData");
            if (_403) return _403;
            
            const { isLogged } = extractProfileInfo(html);
            if (!isLogged) {
                return formatResult("fetchMineData", { 
                status:"error", 
                nextTime:10000, 
                message:"❌ Chưa đăng nhập" 
                });
            }
            
            const security_load = extractSecurityToken(html, 'load_mines_by_type');
            if (!security_load) {
                return formatResult("fetchMineData", { 
                status: "warning", 
                nextTime: 10000, 
                message: "❌ Không tìm thấy security token" 
                });
            }
            
            const postHeaders = {
                "accept": "application/json",
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "x-requested-with": "XMLHttpRequest",
                "referer": pageUrl,
            };
            const allMines = { thuong: [], trung: [], ha: [] };
            
            // Mapping từ UI sang API
            const mineTypeMapping = {
                'thuong': 'gold',
                'trung': 'silver',
                'ha': 'copper'
            };
            
            // Fetch mines cho cả 3 loại
            for (const mineType of ['thuong', 'trung', 'ha']) {
                const apiMineType = mineTypeMapping[mineType];
                const res2 = await queueFetch(apiUrl, {
                method: "POST",
                headers: postHeaders,
                body: `action=load_mines_by_type&mine_type=${apiMineType}&security=${encodeURIComponent(security_load)}`,
                useWindowFetch: false
                });
                const mineJson = await res2.json().catch(() => null);
                
                if (mineJson?.success && mineJson?.data) {
                allMines[mineType] = mineJson.data.map(mine => ({
                    id: mine.id,
                    name: mine.name,
                    type: mineType
                }));
                }
                await wait(300); // Delay giữa các request
            }
            
            // Lưu vào localStorage
            localStorage.setItem('khoangmach_mines_data', JSON.stringify(allMines));
            
            const total = allMines.thuong.length + allMines.trung.length + allMines.ha.length;
            
            return formatResult("fetchMineData", { 
                status: "success", 
                percent: 100,
                nextTime: 0,
                message: `✅ Đã tải ${total} mỏ (Thượng: ${allMines.thuong.length}, Trung: ${allMines.trung.length}, Hạ: ${allMines.ha.length})`,
                data: allMines
            });
            } catch (err) {
            return formatResult("fetchMineData", { 
                status:"error", 
                nextTime:120000, 
                message:`❌ ${err.message}` 
            });
            }
        },

        // ⭐ TIÊN DUYÊN 
        async tienduyen() {
            const {switch_lixi = true, time_check = 3} = await new Promise(resolve => chrome.storage.local.get(['switch_lixi', 'time_check'], resolve)) || {};
            const pageUrl = BASE_URL + "/tien-duyen?t="+Date.now();
            const apiUrl  = BASE_URL + "/wp-json/hh3d/v1/action";

            try {
            // ⭐ Lấy thời gian theo giờ Việt Nam (UTC+7)
            const VN_OFFSET = 7 * 60 * 60 * 1000;
            const currentTime = Date.now();
            const vnTime = currentTime + VN_OFFSET;
            const vnDate = new Date(vnTime);
            const vnHours = vnDate.getUTCHours();
            const vnMinutes = vnDate.getUTCMinutes();

            // Tính các mốc giờ VN dưới dạng timestamp
            const startOfDayVN = Math.floor(vnTime / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
            const sixAM = startOfDayVN + 6 * 60 * 60 * 1000 - VN_OFFSET;
            const elevenFifty = startOfDayVN + 11 * 60 * 60 * 1000 + 50 * 60 * 1000 - VN_OFFSET;
            const noonStart = startOfDayVN + 12 * 60 * 60 * 1000 - VN_OFFSET;
            const noonEnd = startOfDayVN + 14 * 60 * 60 * 1000 - VN_OFFSET;
            const eighteenFifty = startOfDayVN + 18 * 60 * 60 * 1000 + 50 * 60 * 1000 - VN_OFFSET;
            const eveningStart = startOfDayVN + 19 * 60 * 60 * 1000 - VN_OFFSET;
            const eveningEnd = startOfDayVN + 21 * 60 * 60 * 1000 - VN_OFFSET;
            const elevenPM = startOfDayVN + 23 * 60 * 60 * 1000 - VN_OFFSET;
            const nextSixAM = startOfDayVN + 30 * 60 * 60 * 1000 - VN_OFFSET; // +24h +6h

            // Calculate nextTime based on current time
            let nextTime;
            let roomIdMax = 0;

            if (currentTime < sixAM) {
                nextTime = sixAM - currentTime;
            } else if (currentTime < elevenFifty) {
                // Nếu trước 11:50 -> chạy lại lúc 11:50
                nextTime = elevenFifty - currentTime;
            } else if (currentTime < noonStart) {
                // Nếu giữa 11:50 và 12:00 -> chạy ở 12:00
                nextTime = noonStart - currentTime;
            } else if (currentTime < noonEnd) {
                // During noon wedding hours - use time_check
                nextTime = time_check * 60 * 1000;
            } else if (currentTime < eighteenFifty) {
                // Nếu sau trưa nhưng trước 18:50 -> chạy lại lúc 18:50
                nextTime = eighteenFifty - currentTime;
            } else if (currentTime < eveningStart) {
                // Nếu giữa 18:50 và 19:00 -> chạy ở 19:00
                nextTime = eveningStart - currentTime;
            } else if (currentTime < eveningEnd) {
                // During evening wedding hours - use time_check
                nextTime = time_check * 60 * 1000;
            } else if (currentTime < elevenPM) {
                nextTime = elevenPM - currentTime;
            } else {
                nextTime = nextSixAM - currentTime;
            }

            // load html để lấy security
            const res = await queueFetch(pageUrl, {
                headers: { "accept": "text/html", }
            });
            const html = await res.text();
            const _403 = handle403Response(res, "tienduyen");
            if (_403) return _403;
            const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
            
            // Kiểm tra trạng thái đăng nhập
            if (!isLogged) {
                return formatResult("tienduyen", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
            }
            
            const restNonce = getNonce(html, "customRestNonce");
            const securityToken = extractSecurityToken(html);
            if(!restNonce || !securityToken) {
                return formatResult("tienduyen", { status:"warning", nextTime:60000, message:"❌ Lấy security token thất bại!" });
            }
            
            // lấy tất cả các phòng cưới 
            const res2 = await queueFetch(apiUrl, {
                method: "POST",
                headers: {
                "content-type": "application/json",
                "x-requested-with": "XMLHttpRequest",
                "security_token": securityToken,
                "x-wp-nonce": restNonce,        
                "referer": pageUrl,     
                },
                body: JSON.stringify({ action: "show_all_wedding", security_token: securityToken })
            });
            const data = await res2.json().catch(()=>null);
            if(!data?.success) {
                return formatResult("tienduyen", { 
                status:"warning", 
                nextTime: 60000,
                message:`❌ Lấy danh sách phòng cưới thất bại:  ${data?.message || data?.error || data?.data || "Lấy danh sách phòng cưới thất bại"}` 
                });
            }
            await wait(500);
            const rooms = data?.data || [];
            const is_vip = data?.is_vip || false;
            const messagesTotal = [];
            let liXiRewards = [];
            
            if(is_vip) {
                console.log("tienduyen", `🌟 Tài khoản VIP - được chúc phúc nhanh và mở lì xì nhanh.`);
                const resQuickBless = await queueFetch(apiUrl, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-requested-with": "XMLHttpRequest",
                    "x-wp-nonce": restNonce,
                    "referer": pageUrl,
                },
                body: JSON.stringify({ action: "hh3d_quick_bless_all" })
                });
                const dataQuick = await resQuickBless.json().catch(()=>null);
                messagesTotal.push(dataQuick?.message || dataQuick?.data || dataQuick?.data?.message || "Thành công");
                console.log("tienduyen", `🌟 Kết quả chúc phúc nhanh: ${dataQuick?.message || dataQuick?.data || dataQuick?.data?.message || "Thành công"}`);
                // mở lì xì nhanh
                if(switch_lixi) {
                await wait(500);
                const resQuickLiXi = await queueFetch(apiUrl, {
                    method: "POST",
                    headers: {
                    "content-type": "application/json",
                    "x-requested-with": "XMLHttpRequest",
                    "x-wp-nonce": restNonce,
                    "referer": pageUrl,
                    },
                    body: JSON.stringify({ action: "hh3d_quick_open_all_li_xi" })
                });
                const dataLiXi = await resQuickLiXi.json().catch(()=>null);
                // ⭐ XỬ LÝ KẾT QUẢ LÌ XÌ
                if (dataLiXi?.success && dataLiXi?.summary) {
                    // Lưu danh sách phần thưởng từ summary
                    liXiRewards = dataLiXi.summary.map(item => ({
                    icon: item.icon || "🎁",
                    name: item.name || "Vật phẩm",
                    amount: item.total || 0
                    }));
                    
                    // Tạo message chi tiết
                    const rewardsList = liXiRewards.map(item => 
                    `  ${item.icon} ${item.name}: ${item.amount}`
                    ).join('\n');
                    
                    const liXiMessage = `🎉 Mở lì xì nhanh thành công!\n🎊 Phần thưởng nhận được:\n${rewardsList}`;
                    messagesTotal.push(liXiMessage);
                    if(!liXiMessage.includes("không có lì xì nào để mở")) {
                        const timestamp = new Date().toLocaleString('vi-VN', { 
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
                        });
                        // ⭐ Lưu với key có roomId để renderer tìm được (dùng timestamp làm ID giả)
                        const fakeRoomId = Date.now(); // hoặc dùng 'quick' nếu muốn cố định
                        localStorage.setItem(`li_xi_${fakeRoomId}`, `[${timestamp}] ${liXiMessage}`);
                    }
                    console.log("tienduyen", `🌟 ${liXiMessage}`);
                } else {
                    // Fallback nếu không có summary
                    const liXiMessage = dataLiXi?.message || dataLiXi?.data || dataLiXi?.data?.message || "Mở lì xì thành công";
                    messagesTotal.push(`🎉 Mở lì xì nhanh: ${liXiMessage}`);
                    if(!liXiMessage.includes("không có lì xì nào để mở")) {
                        const timestamp = new Date().toLocaleString('vi-VN', { 
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
                        });
                        const fakeRoomId = Date.now();
                        localStorage.setItem(`li_xi_${fakeRoomId}`, `[${timestamp}] ${liXiMessage}`);
                    }
                    console.log("tienduyen", `🌟 Kết quả mở lì xì nhanh: ${liXiMessage}`);
                }
                }
            }
            if(rooms.length === 0) {
                return formatResult("tienduyen", { 
                status:"warning", 
                nextTime: nextTime,
                message:`❌ ${data?.message || "Không có phòng cưới nào"}`,
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
                });
            } else {
            console.log("tienduyen", `🎉 Có ${rooms.length} phòng cưới.`);

            let processedRooms = 0; // Đếm số phòng đã xử lý
            let limitChucPhuc = false;
            let hasUnblessedRoom = false; // Đánh dấu còn phòng chưa chúc phúc SAU KHI XỬ LÝ
            let mostRecentWeddingTime = null; // Tiệc cưới mới nhất
            const messages = [
                "🌺 Nhân sinh hữu hẹn, tu hành hữu duyên! Nguyện hai vị đạo hữu song tu hòa hợp, cùng nhau vượt thiên địa, lưu danh bất hủ! 🏔️",
                "🔥 Đạo tâm kiên định, tay nắm chặt chẳng rời! Chúc hai vị đạo hữu vượt qua muôn vàn thử thách, cùng nhau đăng đỉnh cửu thiên! 🌈",
                "🌸 Duyên khởi từ tâm, đạo hợp bởi ý! Chúc hai vị đạo hữu đồng hành bất diệt, như gió xuân thổi mãi, như sóng biếc vỗ hoài! 🌊",
                "🏯 Đạo tình như trăng sáng, chiếu rọi mãi không phai! Chúc hai vị đạo hữu tu hành viên mãn, bước lên đài sen, hóa thành chân tiên! 🏹",
                "🌟 Hữu duyên thiên định, nguyệt lão chỉ đường! Nguyện đạo lữ vững bền, đồng tâm hợp lực, trường tồn giữa trời đất bao la! 💞",
                "🌠 Thiên duyên vạn kiếp, hội ngộ giữa hồng trần! Nguyện hai vị đạo hữu đồng tâm tu luyện, phi thăng cửu thiên, trường tồn cùng nhật nguyệt! ✨",
                "⚡️ Một bước nhập đạo, vạn kiếp thành tiên! Nguyện hai vị đạo hữu nắm tay tu luyện, phá vỡ thiên kiếp, cùng nhau phi thăng bất diệt! 🕊️",
                "🌿 Trải qua ngàn kiếp luân hồi, cuối cùng tương ngộ! Nguyện hai vị đạo hữu tâm ý tương thông, đồng tu đồng tiến, chứng đắc đại đạo! ⚔️",
                "✨ Một ánh mắt giao hòa, vạn năm chẳng đổi! Nguyện hai vị đạo hữu đồng tâm song tiến, đạo nghiệp rạng rỡ, tu thành chính quả! 🚀",
                "🌌 Định mệnh an bài, thiên địa chứng giám! Nguyện hai vị đạo hữu tu luyện đại thành, nắm giữ chân lý, mãi mãi bên nhau! 🏆"
            ];
            
            for(const room of rooms) {
                const message = messages[Math.floor(Math.random() * messages.length)];
                const roomId = parseInt(room.wedding_room_id);
                if(roomId > roomIdMax) {
                roomIdMax = roomId;
                // store.set('global', "weddingRoomIdMax", roomIdMax);
                
                // ⭐ LƯU THÔNG TIN PHÒNG CƯỚI MỚI VÀO latest_wedding_info ĐỂ ĐỒNG BỘ
                const createdAt = room.created_at || new Date().toISOString().slice(0, 19).replace('T', ' ');
                const createdDate = new Date(createdAt);
                const nextRegistrationTime = createdDate.getTime() + 30 * 60 * 1000;
                
                const weddingInfo = {
                    roomId: roomId,
                    user1: room.user1_name || 'N/A',
                    user2: room.user2_name || 'N/A',
                    user1Id: room.user1_id || null,
                    user2Id: room.user2_id || null,
                    createdAt: createdAt,
                    nextRegistrationTime: new Date(nextRegistrationTime).toLocaleString('vi-VN'),
                    nextRegistrationTimestamp: nextRegistrationTime
                };
                // store.set('global', 'latest_wedding_info', weddingInfo);
                }
                
                let roomInfo = `🏰 Phòng ${room.wedding_room_id} (${room.user1_name} ♥ ${room.user2_name}): `;
                let roomResult = "";
                let roomBlessed = room.has_blessed; // Track trạng thái chúc phúc của phòng này
                
                // Xử lý chúc phúc
                if(!room.has_blessed) {
                const res3 = await queueFetch(apiUrl, {
                    method: "POST",
                    headers: {
                    "content-type": "application/json",
                    "x-requested-with": "XMLHttpRequest",
                    "x-wp-nonce": restNonce,
                    "referer": pageUrl,
                    },
                    body: JSON.stringify({
                    action: "hh3d_add_blessing",
                    wedding_room_id: roomId,
                    message: message
                    })
                });

                const data3 = await res3.json().catch(()=>null);
                console.log("tienduyen", `Phòng ${room.wedding_room_id} chúc phúc: ` + JSON.stringify(data3));
                if(data3?.success) {
                    roomResult = "✅ Đã chúc phúc: " + (data3?.message || data3?.data?.message || "Thành công");
                    roomBlessed = true; // ⭐ Đánh dấu đã chúc phúc thành công
                } else {
                    roomResult = "❌ Chưa chúc phúc: " + (data3?.message || data3?.data?.message || "Thất bại");
                }
                if(data3?.code=== 'insufficient_mycred'){
                    return formatResult("tienduyen", { 
                    status:"error", 
                    percent: 0,
                    message: data3?.message || data3?.data?.message || `❌ Không đủ Tuvi để chúc phúc!` 
                    });
                }
                if(data3?.code === "ip_limit_exceeded" || data3?.data?.message.includes("đạt tối đa số tài khoản")) {
                    limitChucPhuc = true;
                }
                await wait(1000);
                }

                // Xử lý lì xì
                if(room.has_li_xi && switch_lixi) {
                await wait(500);
                const res4 = await queueFetch(apiUrl, {
                    method: "POST",
                    headers: {
                    "content-type": "application/json",
                    "x-requested-with": "XMLHttpRequest",
                    "x-wp-nonce": restNonce,
                    "referer": pageUrl,
                    },
                    body: JSON.stringify({
                    action: "hh3d_receive_li_xi",
                    wedding_room_id: roomId
                    })
                });

                const data4 = await res4.json().catch(()=>null);
                console.log("tienduyen", `Phòng ${room.wedding_room_id} lì xì: ` + JSON.stringify(data4));
                if(data4?.success) {
                    roomResult = " | ✅ Đã nhận lì xì: " + (data4?.message || data4?.data?.message || "Thành công");
                    const timestamp = new Date().toLocaleString('vi-VN', { 
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
                    });
                    localStorage.setItem(`li_xi_${room.wedding_room_id}`, `[${timestamp}] ` + (data4?.message || data4?.data?.message || "Không rõ"));
                } else {
                    roomResult = " | ❌ Chưa nhận lì xì: " + (data4?.message || data4?.data?.message || "Thất bại");
                }
                await wait(1000);
                }
                if(roomResult==="") {
                if(room.has_blessed) {
                    roomInfo += "✅ Đã chúc phúc, ";
                } else roomInfo += "❌ Chưa chúc phúc, ";
                if(room.has_sent_li_xi) {
                    roomInfo += "✅ Đã phát lì xì ";
                } else roomInfo += "❌ Chưa phát lì xì ";
                } else {
                roomInfo += roomResult;
                }
                messagesTotal.push(roomInfo);
                processedRooms++;
                
                // ⭐ Thu thập thông tin để tính nextTime - dùng roomBlessed thay vì room.has_blessed
                if (!roomBlessed) {
                hasUnblessedRoom = true; // Phòng này vẫn chưa được chúc phúc (hoặc chúc thất bại)
                }
                
                if (room.created_at) {
                // Parse created_at từ format "2025-09-28 13:11:49" (giờ VN)
                const [datePart, timePart] = room.created_at.split(' ');
                const [year, month, day] = datePart.split('-');
                const [hour, minute, second] = timePart.split(':');
                
                const createdVNTime = Date.UTC(
                    parseInt(year), 
                    parseInt(month) - 1, 
                    parseInt(day), 
                    parseInt(hour), 
                    parseInt(minute), 
                    parseInt(second || 0)
                );
                const createdTimestamp = createdVNTime - VN_OFFSET;
                const createdDate = new Date(createdTimestamp);
                
                if (!mostRecentWeddingTime || createdDate > mostRecentWeddingTime) {
                    mostRecentWeddingTime = createdDate;
                }
                }
            }

            // ⭐ TÍNH TOÁN LẠI NEXTTIME SAU KHI XỬ LÝ TẤT CẢ CÁC PHÒNG
            // Chỉ áp dụng khi đang trong giờ cưới (12:00-14:00 hoặc 19:00-21:00)
            const isInWeddingHours = (currentTime >= noonStart && currentTime < noonEnd) || 
                                        (currentTime >= eveningStart && currentTime < eveningEnd);
            
            if (isInWeddingHours && rooms.length > 0) {
                // Ưu tiên: Nếu còn phòng chưa chúc -> check thường xuyên
                if (hasUnblessedRoom) {
                nextTime = time_check * 60 * 1000;
                console.log("tienduyen", `⚠️ Còn phòng chưa chúc phúc, kiểm tra lại sau ${time_check} phút`);
                } else if (mostRecentWeddingTime) {
                // Nếu tất cả đã chúc -> đợi tiệc cưới tiếp theo (30 phút sau tiệc mới nhất)
                const nextWeddingTime = mostRecentWeddingTime.getTime() + 30 * 60 * 1000;
                const timeUntilNextWedding = nextWeddingTime - currentTime;
                
                if (timeUntilNextWedding > 0) {
                    nextTime = timeUntilNextWedding;
                    const minutesUntilNext = Math.floor(timeUntilNextWedding / 60000);
                    console.log("tienduyen", `⏰ Tiệc cưới mới nhất: ${mostRecentWeddingTime.toLocaleString('vi-VN')}`);
                    console.log("tienduyen", `⏰ Tiệc cưới tiếp theo có thể diễn ra sau ${minutesUntilNext} phút`);
                } else {
                    nextTime = time_check * 60 * 1000;
                    console.log("tienduyen", `⏰ Đã quá 30 phút từ tiệc cưới mới nhất, kiểm tra lại sau ${time_check} phút`);
                }
                }
            }

            return formatResult("tienduyen", {
                status: "success",
                nextTime: nextTime,
                percent: 100,
                message: [`✨ Tổng ${rooms.length} phòng cưới:`, ...messagesTotal ].join("\n"),
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role , roomIdMax, limitChucPhuc }
            });
            }
            } catch (err) {
            if(err.message.includes("Unauthorized")) {
                return formatResult("tienduyen", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập!" });
            }
            return formatResult("tienduyen", { status:"warning", nextTime:60000, message:`❌ Không xác định: ${err.message}` });
            }
        },

        // ⭐ ĐỔ THẠCH 
        async dothach(params) {
            const { firstChoice, secondChoice, betsOptions = "none" } = params || {};
            const pageUrl = BASE_URL + "/do-thach-hh3d?t="+Date.now();
            const apiUrl = BASE_URL + "/wp-content/themes/halimmovies-child/hh3d-ajax.php";
            
            try {
            const resHtml = await queueFetch(pageUrl, {
                headers: {
                "accept": "text/html"
                }
            });
            const html = await resHtml.text();
            const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
            
            const _403 = handle403Response(resHtml, "dothach");
            if (_403) return _403;
            // Kiểm tra trạng thái đăng nhập
            if (!isLogged) {
                return formatResult("dothach", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
            }
            
            let dataDothach = [];    
            const securityToken = extractSecurityToken(html);
            // console.log('Dothach securityToken:', securityToken);
            if (!securityToken) {
                return formatResult("dothach", { status: "warning", nextTime: 60000, message: "❌ Không tìm thấy securityToken" });
            }

            const postHeaders = {
                "accept": "application/json, text/javascript, */*;q=0.01",
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "x-requested-with": "XMLHttpRequest",
                "referer": pageUrl,
            };

            // Load danh sách đá và thời gian server
            const res = await queueFetch(apiUrl, {
                method: "POST",
                headers: postHeaders,
                body: `action=load_do_thach_data&security_token=${securityToken}`
            });

            const data = await res.json();
            // console.log('Dothach Data:', data);
            if (!data?.success) {
                return formatResult("dothach", {
                status: "warning",
                nextTime: 10000,
                message: "❌ Lấy dữ liệu đá thất bại: " + (data?.data?.message || data?.data || "Thất bại")
                });
            }

            // ⭐ Lấy thời gian server và chuyển sang giờ Việt Nam (UTC+7)
            const serverTime = data.data.server_time.timestamp * 1000;
            const VN_OFFSET = 7 * 60 * 60 * 1000; // UTC+7
            
            // Thời gian VN = serverTime + offset
            const vnTime = serverTime + VN_OFFSET;
            const vnDate = new Date(vnTime);
            const vnHours = vnDate.getUTCHours();
            const dateStr = `${String(vnDate.getUTCDate()).padStart(2,'0')}-${String(vnDate.getUTCMonth()+1).padStart(2,'0')}-${vnDate.getUTCFullYear()}`;

            // Tính các mốc giờ VN dưới dạng timestamp
            const startOfDayVN = Math.floor(vnTime / (24 * 60 * 60 * 1000)) * (24 * 60 * 60 * 1000);
            const sixAM = startOfDayVN + 6 * 60 * 60 * 1000 - VN_OFFSET;
            const onePM = startOfDayVN + 13 * 60 * 60 * 1000 - VN_OFFSET;
            const fourPM = startOfDayVN + 16 * 60 * 60 * 1000 - VN_OFFSET;
            const ninePM = startOfDayVN + 21 * 60 * 60 * 1000 - VN_OFFSET;
            const nextSixAM = startOfDayVN + 30 * 60 * 60 * 1000 - VN_OFFSET; // +24h +6h

            // xác định timeRecord: 13 cho khung sáng (13:00-15:59), 21 cho khung tối (21:00-..)
            const timeRecord = (vnHours >= 13 && vnHours < 16) ? "13" : (vnHours >= 21 && vnHours < 24) ? "21" : "0";
            // helper: lưu ưu tiên reward trước, nếu không có thì lưu winningStone
            function saveDothachRecord(dateLabel, timeRecord, rewardMsg, winningStone) {
                try {
                if(timeRecord === "0") return; // không lưu nếu không phải khung giờ nhận thưởng
                const key = `dothach_${dateLabel}_${timeRecord}`;
                if (rewardMsg) {
                    localStorage.setItem(key, String(rewardMsg));
                    console.log("dothach", `Lưu reward -> ${key}`);
                } else if (winningStone) {
                    const winMsg = `🏆 Đá win: ${winningStone.name} (x${winningStone.reward_multiplier || "?"})`;
                    localStorage.setItem(key, String(winMsg));
                    console.log("dothach", `Lưu winningStone -> ${key}`);
                }
                } catch (e) {
                console.log("dothach", `❌ Lỗi lưu dothach record: ${e?.message || e}`);
                }
            }

            // ⭐ Lấy thông tin đá đã cược và đá thắng
            const stones = data.data.stones || [];
            const betPlacedStones = stones.filter(s => s.bet_placed);
            const winningStoneId = data.data.winning_stone_id;
            const winningStone = winningStoneId ? stones.find(s => s.stone_id === winningStoneId) : null;

            // Nhận thưởng
            await wait(500);
            const res2 = await queueFetch(apiUrl, {
                method: "POST",
                headers: postHeaders,
                body: `action=claim_do_thach_reward&security_token=${securityToken}`
            });
            const rewardJson = await res2.json().catch(() => null);
            if (rewardJson?.success) {
                // Đang trong giờ mở thưởng và có thưởng
                let rewardMsg = rewardJson?.data?.message || rewardJson?.message;      
                if ((serverTime >= onePM && serverTime < fourPM) || serverTime >= ninePM) {
                const nextRewardTime = serverTime >= ninePM ? nextSixAM : fourPM;
                rewardMsg = `🎉 Trúng thưởng(x${winningStone?.reward_multiplier || "?"}): ${rewardMsg}`;
                saveDothachRecord( dateStr, timeRecord, `🎉 ${rewardMsg}`, null);
                dataDothach.push(rewardMsg);
                return formatResult("dothach", {
                    status: "success",
                    percent: serverTime >= ninePM ? 100 : 50,
                    nextTime: nextRewardTime - serverTime,
                    message: rewardMsg,
                    data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role , winningStone, dataDothach  }
                });
                } else {
                // Ngoài giờ mở thưởng (trong giờ đặt cược tiếp theo)
                console.log("dothach", `🎉 Trúng thưởng: ${rewardMsg}`);
                saveDothachRecord( dateStr, timeRecord, `🎉 ${rewardMsg}`, null);
                dataDothach.push(rewardMsg);
                }
            } else {
                // ⭐ KHÔNG CÓ THƯỞNG - nếu trong giờ mở thưởng thì hiển thị đá đã cược và đá win
                if ((serverTime >= onePM && serverTime < fourPM) || serverTime >= ninePM) {
                // Trong giờ mở thưởng nhưng không trúng
                const nextRewardTime = serverTime >= ninePM ? nextSixAM : fourPM;
                
                let message = "";
                
                // Hiển thị 2 đá đã cược nếu có
                if (betPlacedStones.length > 0) {
                    const betInfo = betPlacedStones.map(stone => 
                    `${stone.name} (x${stone.reward_multiplier})`
                    ).join(", ");
                    message += `\n🎲 Đá đã cược: ${betInfo}`;
                }
                
                // Hiển thị đá win
                if (winningStone) {
                    message += `\n🏆 Đá win: ${winningStone.name} (x${winningStone.reward_multiplier})`;
                    saveDothachRecord( dateStr, timeRecord, null, winningStone);
                }
                
                return formatResult("dothach", {
                    status: "success",
                    percent: serverTime >= fourPM ? 100 : 50,
                    nextTime: nextRewardTime - serverTime,
                    message: message,
                    data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, winningStone }
                });
                } else {
                // Ngoài giờ mở thưởng và không có thưởng - không làm gì
                console.log("dothach", `⚠️ Chưa có thưởng để nhận`);
                }
            }

            // ⭐ Kiểm tra khung giờ và hiển thị thông tin phù hợp
            if (serverTime < sixAM) {
                // Trước 6h sáng - chờ đến giờ mở cược
                let msg = "🌙 Chờ đến giờ mở cược (06:00) (VN)";
                if (winningStone) {
                msg += `\n🏆 Đá win trước đó: ${winningStone.name} (x${winningStone.reward_multiplier})`;
                saveDothachRecord( dateStr, timeRecord, null, winningStone);
                }
                return formatResult("dothach", {
                status: "pending",
                percent: 0,
                nextTime: sixAM - serverTime,
                message: msg,
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, winningStone }
                });
            }

            if (serverTime >= onePM && serverTime < fourPM) {
                // 13-16h - giờ mở thưởng buổi sáng, chờ đến giờ mở cược chiều
                let msg = "🌅 Chờ đến giờ mở cược chiều (16:00) (VN)";
                if (winningStone) {
                msg += `\n🏆 Đá win trước đó: ${winningStone.name} (x${winningStone.reward_multiplier})`;
                saveDothachRecord( dateStr, timeRecord, null, winningStone);
                }
                return formatResult("dothach", {
                status: "pending",
                percent: 50,
                nextTime: fourPM - serverTime,
                message: msg,
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, winningStone }
                });
            }

            if (serverTime >= ninePM || serverTime < sixAM) {
                // Sau 21h - giờ mở thưởng buổi tối, chờ đến ngày mai
                let msg = "🌙 Chờ đến ngày mai (06:00) (VN)";
                if (winningStone) {
                msg += `\n🏆 Đá win trước đó: ${winningStone.name} (x${winningStone.reward_multiplier})`;
                saveDothachRecord( dateStr, timeRecord, null, winningStone);
                }
                return formatResult("dothach", {
                status: "pending",
                percent: 100,
                nextTime: nextSixAM - serverTime,
                message: msg,
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role , winningStone }
                });
            }

            // ⭐ Nếu đã đặt đủ cược - hiển thị đá đã cược và giờ mở thưởng
            if (data.data.bet_limit_reached) {
                const isMorning = serverTime < onePM;
                const nextRewardTime = isMorning ? onePM : ninePM;
                const rewardTimeText = isMorning ? "13:00" : "21:00";
                
                let msg = isMorning 
                ? `✅ Đã đặt đủ cược buổi sáng (VN), chờ mở thưởng (${rewardTimeText}) (VN)`
                : `✅ Đã đặt đủ cược buổi chiều (VN), chờ mở thưởng (${rewardTimeText}) (VN)`;
                
                // Hiển thị 2 đá đã cược
                if (betPlacedStones.length > 0) {
                const betInfo = betPlacedStones.map(stone => 
                    `${stone.name} (x${stone.reward_multiplier})`
                ).join(", ");
                msg += `\n🎲 Đá đã cược: ${betInfo}`;
                }
                
                return formatResult("dothach", {
                status: "success",
                percent: isMorning ? 50 : 100,
                nextTime: nextRewardTime - serverTime,
                message: msg,
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, winningStone }
                });
            }

            // ⭐ Chưa đặt cược - tiến hành đặt cược
            // Sắp xếp và chọn đá theo cấu hình
            const allStones = stones
                .map(s => ({
                id: s.stone_id,
                name: s.name,
                multiplier: parseFloat(s.reward_multiplier),
                betPlaced: s.bet_placed
                }))
                .sort((a, b) => b.multiplier - a.multiplier);

            // Chọn đá theo cấu hình
            let first, second;
            switch (betsOptions) {
                case "D1D2": 
                first = allStones[0]; second = allStones[1]; 
                break;
                case "T1T2":
                first = allStones[2]; second = allStones[3];
                break; 
                case "Ti1Ti2":
                first = allStones[4]; second = allStones[5];
                break;
                case "RandomDT": {
                const options = allStones.slice(0, 4);
                first = options[Math.floor(Math.random() * options.length)];
                do {
                    second = options[Math.floor(Math.random() * options.length)];
                } while (first.id === second.id);
                break;
                }
                case "RandomAll": {
                first = allStones[Math.floor(Math.random() * allStones.length)];
                do {
                    second = allStones[Math.floor(Math.random() * allStones.length)];
                } while (first.id === second.id);
                break;
                }
                case "none":
                default: {
                // Chọn theo firstChoice và secondChoice
                const stoneMap = {
                    "D1": 0, "D2": 1,
                    "T1": 2, "T2": 3,
                    "Ti1": 4, "Ti2": 5
                };
                first = allStones[stoneMap[firstChoice] || 0];
                second = allStones[stoneMap[secondChoice] || 1];
                }
            }

            if (!first || !second) {
                return formatResult("dothach", {
                status: "warning",
                nextTime: 60000,
                message: "❌ Không tìm thấy đá phù hợp để đặt cược"
                });
            }

            // Đặt cược
            let resultBet1 = first.betPlaced;
            let resultBet2 = second.betPlaced;

            if (!resultBet1) {
                const res3 = await queueFetch(apiUrl, {
                method: "POST",
                headers: postHeaders,
                body: `action=place_do_thach_bet&security_token=${encodeURIComponent(securityToken)}&stone_id=${first.id}&bet_amount=20`
                });
                const bet1Json = await res3.json();
                resultBet1 = bet1Json?.success || bet1Json?.data?.includes("đã cược");
                await wait(1000);
            }

            if (!resultBet2) {
                const res4 = await queueFetch(apiUrl, {
                method: "POST",
                headers: postHeaders,
                body: `action=place_do_thach_bet&security_token=${encodeURIComponent(securityToken)}&stone_id=${second.id}&bet_amount=20`
                });
                const bet2Json = await res4.json();
                resultBet2 = bet2Json?.success || bet2Json?.data?.includes("đã cược");
            }

            const isOk = resultBet1 && resultBet2;
            const isMorning = serverTime < onePM;
            const nextRewardTime = isMorning ? onePM : ninePM;
            const rewardTimeText = isMorning ? "13:00" : "21:00";
            
            let message = "";
            if (isOk) {
                message = `✅ Cược thành công, chờ mở thưởng (${rewardTimeText})(VN)\n🎲 Đá đã cược: ${first.name}(x${first.multiplier}), ${second.name}(x${second.multiplier})`;
            } else {
                message = `❌ Cược thất bại: [${resultBet1 ? "OK":"FAIL"}-${first.name}, ${resultBet2 ? "OK":"FAIL"}-${second.name}]`;
            }

            // ⭐ Thêm thông tin Đá win trước đó đó nếu có
            if (winningStone) {
                message += `\n🏆 Đá win trước đó: ${winningStone.name} (x${winningStone.reward_multiplier})`;
                saveDothachRecord( dateStr, timeRecord, null, winningStone);
            }
            
            return formatResult("dothach", {
                status: isOk ? "success" : "warning",
                percent: isOk ? (isMorning ? 50 : 100) : 0,
                nextTime: isOk ? (nextRewardTime - serverTime) : 10000,
                message: message,
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, winningStone }
            });

            } catch (err) {
            if(err.message.includes("Unauthorized")) {
                return formatResult("dothach", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập!" });
            }
            return formatResult("dothach", {
                status: "warning",
                nextTime: 120000,
                message: `❌ ${err.message}`
            });
            }
        },
        // ⭐ BÍ CẢNH (Implemented)
        async bicanh() {
            const pageUrl = BASE_URL + "/bi-canh-tong-mon?t=" + Date.now();
            const apiCheckUrl = BASE_URL + "/wp-json/tong-mon/v1/check-attack-cooldown";
            const apiAttackUrl = BASE_URL + "/wp-json/tong-mon/v1/attack-boss";
            const apiClaimUrl = BASE_URL + "/wp-json/tong-mon/v1/claim-boss-reward";
            try {
            const res = await queueFetch(pageUrl, {headers: {"accept": "text/html"}});
            const html = await res.text();
            const _403 = handle403Response(res);
            if (_403) return _403;
            
            const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
            if (!isLogged) return formatResult("bicanh", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
            
            const wpNonce = extractWpRestNonce(html);
            if (!wpNonce) return formatResult("bicanh", { status:"warning", nextTime:10000, message:"❌ Không tìm thấy nonce" });
            
            const postHeaders = {
                "accept": "application/json",
                "content-type": "application/json",
                "x-requested-with": "XMLHttpRequest",
                "x-wp-nonce": wpNonce,
                "referer": pageUrl,
            };
            
            // Claim reward trước
            const resClaim = await queueFetch(apiClaimUrl, {
                method: "POST",
                headers: postHeaders,
                body: JSON.stringify({})
            });
            
            const claimJson = await resClaim.json().catch(()=>null);
            if (claimJson?.success) {
                return formatResult("bicanh", { status:"success", nextTime:10000, percent:100, message:`🏆 ${claimJson?.message}` });
            }
            
            // Kiểm tra cooldown
            await wait(500);
            const res2 = await queueFetch(apiCheckUrl, {
                method: "POST",
                headers: postHeaders,
                body: JSON.stringify({})
            });
            
            const checkJson = await res2.json().catch(()=>null);
            if (!checkJson?.success) return formatResult("bicanh", { status:"warning", nextTime:60000, message:"❌ Kiểm tra thất bại" });
            
            if (!checkJson?.can_attack) {
                const minutes = Math.floor(checkJson?.minutes || 6);
                const seconds = Math.floor(checkJson?.seconds || 59);
                return formatResult("bicanh", {
                status:"pending",
                nextTime: (minutes * 60 + seconds) * 1000 + 2000,
                message:`⌛ Chờ ${minutes}:${seconds}`
                });
            }
            
            // Tấn công boss
            await wait(500);
            const res3 = await queueFetch(apiAttackUrl, {
                method: "POST",
                headers: postHeaders,
                body: JSON.stringify({})
            });
            
            const attackJson = await res3.json().catch(()=>null);
            if (!attackJson?.success) return formatResult("bicanh", { status:"warning", nextTime:60000, message:`❌ ${attackJson?.message}` });
            
            return formatResult("bicanh", {
                status:"success",
                nextTime: 7*60*1000,
                percent: 60,
                message:`✅ ${attackJson?.message}`,
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
            });
            } catch (err) {
            return formatResult("bicanh", { status:"error", nextTime:60000, message:`❌ ${err.message}` });
            }
        },

        
        // vòng quay
        async vongquay(params) {
        const pageUrl = BASE_URL + "/vong-quay-phuc-van?t="+Date.now();
        const apiUrl = BASE_URL + "/wp-json/lottery/v1/spin";
        try {
            // lấy html
            const resPage = await queueFetch(pageUrl, { 
            method: "GET",
            headers: {
                "accept": "text/html",
            }
            });
            const html = await resPage.text();
            const resNonce = extractWpNonce(html);
            const securityToken = extractSecurityToken(html);   
            if (!resNonce) {
            return formatResult("vongquay", { 
                status: "warning", 
                nextTime: 10000,
                percent: 0, 
                message: "❌ Không thể lấy token" 
            });
            }
            const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
            const _403 = handle403Response(resPage, "vongquay");
            if (_403) return _403;
            // Kiểm tra trạng thái đăng nhập
            if (!isLogged) {
            return formatResult("vongquay", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
            }
            
            const postHeaders = {
            "accept": "application/json, text/javascript, */*; q=0.01", 
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-requested-with": "XMLHttpRequest",
            "x-wp-nonce": resNonce,
            'X-Security-Token': securityToken,
            "referer": pageUrl,
            };

            const prizes = []; // Mảng lưu các phần thưởng
            let totalSpins = 0; // Tổng số lượt quay
            let completedSpins = 0; // Số lượt đã quay

            const res = await queueFetch(apiUrl, { method: "POST", headers: postHeaders });
            const data = await res.json().catch(() => null);
            if (!data?.success) {
            if(data?.message && data?.message.includes("hết lượt quay")) {
                return formatResult("vongquay", {
                status: "done",
                nextTime: 0,
                percent: 100,
                message: `🎉 Đã quay hết lượt hôm nay: ${data?.message || data?.data || data?.error || "Hoàn thành"}`
                });
            }
            return formatResult("vongquay", {
                status: "warning",
                nextTime: 10000,
                percent: 0,
                message: `❌ ${data?.message || data?.data || data?.error || "Thất bại"}` 
            });
            }
            
            prizes.push(data?.prize.value); // Thêm phần thưởng đầu tiên vào mảng
            completedSpins++;
            const remaining = parseInt(data?.user_info?.remaining_spins || 0);
            totalSpins = remaining + 1; // +1 vì đã quay 1 lần

            console.log("vongquay", `🎉 Nhận được: ${data?.prize.value || "Không rõ"} (${completedSpins}/${totalSpins})`);

            // quay tiếp cho đến khi hết lượt
            for(let i = remaining; i > 0; i--) {
            await wait(2000);
            const resSpin = await queueFetch(apiUrl, { method: "POST", headers: postHeaders });
            const spinJson = await resSpin.json().catch(() => null);
            if (!spinJson?.success) {
                console.log("vongquay", `❌ Quay vòng tiếp thất bại: ${spinJson?.message || spinJson?.data || spinJson?.error || "Thất bại"}`);
                break;
            }
            prizes.push(spinJson?.prize.value); // Thêm phần thưởng vào mảng
            completedSpins++;
            console.log("vongquay", `🎉 Nhận được: ${spinJson?.prize.value || "Không rõ"} (${completedSpins}/${totalSpins})`);
            }

            const percent = (completedSpins / totalSpins) * 100;
            const prizeString = prizes.join(", ");

            // ⭐ LƯU VÀO STORE (theo thứ tự slot đã quay trong ngày)
            // const today = new Date();
            // const dateKey = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
            
            // // Lấy số slot đã lưu hôm nay (từ các lần chạy trước)
            // let existingSlots = [];
            // try {
            //   const savedData = store.filter(`vongquay_${dateKey}_slot_`);
            //   existingSlots = Object.keys(savedData || {})
            //     .filter(k => k.startsWith(`vongquay_${dateKey}_slot_`))
            //     .map(k => parseInt(k.split('_slot_')[1]))
            //     .filter(n => !isNaN(n))
            //     .sort((a, b) => a - b);
            // } catch (e) {
            //   existingSlots = [];
            // }
            // // Tính index bắt đầu cho lần chạy này
            // const startIndex = existingSlots.length > 0 ? Math.max(...existingSlots) + 1 : 1;
            
            // // Lưu từng slot mới (tối đa 4 slot trong ngày)
            // for (let i = 0; i < prizes.length; i++) {
            //   const slotIndex = startIndex + i;
            //   if (slotIndex > 4) {
            //     console.log("vongquay", `⚠️ Đã đạt giới hạn 4 slot trong ngày`);
            //     break;
            //   }
            //   const slotKey = `vongquay_${dateKey}_slot_${slotIndex}`;
            //   await localStorage.setItem(slotKey, prizes[i]);
            //   console.log("vongquay", `💾 Lưu slot ${slotIndex}: ${prizes[i]}`);
            // }

            return formatResult("vongquay", { 
            status: "done", 
            nextTime: 0,
            percent: percent,
            message: `🎉 Chúc mừng bạn đã nhận được: ${prizeString}` ,
            data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
            });

        } catch (err) {
            if(err.message.includes("Unauthorized")) {
            return formatResult("vongquay", { 
                status: "error", 
                nextTime: 10000,
                percent: 0, 
                message: "❌ Chưa đăng nhập!" 
            });
            }
            return formatResult("vongquay", { 
            status: "warning", 
            nextTime: 120000,
            percent: 0,
            message: `❌ ${err.message}` 
            });
        }
        },
        // hoạt động hàng ngày
        async hdhn(params) {
        const pageUrl = BASE_URL + "/bang-hoat-dong-ngay?t=1493d";
        const apiUrl = BASE_URL + "/wp-admin/admin-ajax.php";
        try {
            // lấy html
            const resPage = await queueFetch(pageUrl, { method: "GET",
            headers: {
                "accept": "text/html",
            }
            });
            const html = await resPage.text();
            const _403 = handle403Response(resPage, "hdhn");
            if (_403) return _403;
            const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
            
            // Kiểm tra trạng thái đăng nhập
            if (!isLogged) {
            return formatResult("hdhn", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
            }
            
            const postHeaders = { 
            "accept": "application/json, text/javascript, */*; q=0.01",
            "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
            "x-requested-with": "XMLHttpRequest",
            "referer": pageUrl,
            };
            const res1 = await queueFetch(apiUrl, { 
            method: "POST", headers: postHeaders,
            body: "action=daily_activity_reward&stage=stage1"      
            });
            const res2 = await queueFetch(apiUrl, { 
            method: "POST", headers: postHeaders,
            body: "action=daily_activity_reward&stage=stage2"
            });
            const data1 = await res1.json().catch(() => null);
            const data2 = await res2.json().catch(() => null);
            const messages = [];
            let checkDone1 = true;
            let checkDone2 = true;
            if(data1?.success) {
            messages.push("Rương 1: " + data1?.data?.message || "Nhận rương thưởng 1 thành công");
            console.log("hdhn", `✅ ${data1?.data?.message || "Nhận rương thưởng 1 thành công"}`);
            checkDone1 = true;
            const date = new Date().toISOString().slice(0,10);
            const key = "hdhn_ruong1_" + date;
            localStorage.setItem(key, data1?.data?.message || "Nhận rương thưởng 1 thành công");
            } else if(data1?.data?.message) {
            messages.push("Rương 1: " + data1?.data?.message);
            console.log("hdhn", `❌ ${data1?.data?.message}`);
            if(data1?.data?.message.includes("đã nhận")) {
                checkDone1 = true;
            } else {
                checkDone1 = false;
            }
            }
            if(data2?.success) {
            messages.push("Rương 2: " + (data2?.data?.message || "Nhận rương thưởng 2 thành công"));
            console.log("hdhn", `✅ ${data2?.data?.message || "Nhận rương thưởng 2 thành công"}`);
            checkDone2 = true;
            const date = new Date().toISOString().slice(0,10);
            const key = "hdhn_ruong2_" + date;
            localStorage.setItem(key, data2?.data?.message || "Nhận rương thưởng 2 thành công");
            } else if(data2?.data?.message) {
            messages.push("Rương 2: " + data2?.data?.message);
            console.log("hdhn", `❌ ${data2?.data?.message}`);
            if(data2?.data?.message.includes("đã nhận")) {
                checkDone2 = true;
            } else {
                checkDone2 = false;
            }
            }
        
            const percent = ( (checkDone1 ? 1 : 0) + (checkDone2 ? 1 : 0) ) / 2 * 100;
            const checkDoneAll = checkDone1 && checkDone2;
            return formatResult("hdhn", { 
            status: checkDoneAll ? "done" : "success", nextTime: 5 * 60 *1000, percent: percent, message: messages.join("\n"),
            data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
            });
        } catch (err) {
            if(err.message.includes("Unauthorized")) {
            return formatResult("hdhn", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập!" });
            }   
            return formatResult("hdhn", { status:"warning", nextTime:120000, message:`❌ ${err.message}` });
        }
        },

        // đua top
        async duatop(params) {
        const apiUrl = BASE_URL + "/wp-json/hh3d/v1/action";
        const pageUrl = BASE_URL + "/dua-top-hh3d?t="+Date.now();
        // Hàm chuẩn hóa text (giống vandap)
        function normalizeText(text) {
            return text
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/đ/g, "d").replace(/Đ/g, "D")
            .replace(/[^a-zA-Z0-9\s]/g, "")
            .replace(/\s+/g, " ")
            .toLowerCase()
            .trim();
        }

        try {
            const resPage = await queueFetch(pageUrl, { 
            method: "GET",
            headers: {  
                "accept": "text/html",
            },
            useWindowFetch: true // sử dụng window.fetch để tránh lỗi CORS
            });
            const html = await resPage.text();
            const _403 = handle403Response(resPage, "duatop");
            if (_403) return _403;
            const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
            
            // Kiểm tra trạng thái đăng nhập
            if (!isLogged) {
            return formatResult("duatop", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
            }
            
            const xnonce = extractWpRestNonce(html);
            const securityToken = extractSecurityToken(html);
            if (!xnonce) {
            return formatResult("duatop", {
                status: "warning",
                nextTime: 60000,
                percent: 0,
                message: "❌ Không lấy được token"
            });
            }

            const postHeaders = {
            "accept": "application/json, text/javascript, */*; q=0.01",
            "content-type": "application/json",
            "x-requested-with": "XMLHttpRequest",
            'X-WP-Nonce': xnonce,
            'X-DuaTop-Token': securityToken,
            'X-TD-Timestamp': Date.now().toString(),
            "Referer": pageUrl,
            };

            // ⭐ GỌI API LẤY CÂU HỎI TRƯỚC (bỏ bước kiểm tra wait_time)
            const questionRes = await queueFetch(apiUrl, {
            method: "POST", headers: postHeaders,
            body: JSON.stringify({
                action: "hh3d_get_question",
                dua_top_token: securityToken,
                _td_fp: Buffer.from(Date.now().toString()).toString('base64'),
                _td_ts: Date.now()
            })
            });
            if (questionRes.status !== 200) {
            return formatResult("duatop", {
                status: "warning",
                nextTime: 60000,
                percent: 0,
                message: `❌ Không lấy được câu hỏi: ${questionRes.status}`
            });
            }

            const questionData = await questionRes.json().catch(() => null);
            
            // ⭐ KIỂM TRA ERROR - SỰ KIỆN CHƯA BẮT ĐẦU HOẶC THỜI GIAN CHỜ
            if (questionData.error) {
            const message = questionData.message || "Lỗi không xác định";
            console.log("duatop", `⚠️ ${message}`);
            if(message.includes("đã kết thúc") || message.includes("chưa diễn ra") || message.includes("chưa bắt đầu")) {
                console.log("duatop", `⚠️ ${message}` || `⏳ Sự kiện chưa bắt đầu hoặc đã kết thúc.`);
                return formatResult("duatop", {
                status: "done",
                nextTime: 0,
                percent: 100,
                message: `⏳ ${message}`
                });
            }
            
            // Parse thời gian từ message nếu có
            // Ví dụ: "⏳ Sự kiện chưa bắt đầu! Sự kiện sẽ bắt đầu vào ngày 19-12-2025."
            // Hoặc "⏳ Vui lòng chờ 5 phút nữa"
            
            let nextTime = 300000; // Mặc định 5 phút
            
            // Kiểm tra nếu có thông tin ngày bắt đầu
            const dateMatch = message.match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
            if (dateMatch) {
                const [_, day, month, year] = dateMatch;
                const startDate = new Date(`${year}-${month}-${day}T00:00:00+07:00`);
                const now = new Date();
                const diffMs = startDate.getTime() - now.getTime();
                
                if (diffMs > 0) {
                // Chờ đến ngày bắt đầu (nhưng check lại mỗi 1 giờ)
                nextTime = Math.min(diffMs, 3600000);
                console.log("duatop", `⏰ Sự kiện bắt đầu vào ${day}-${month}-${year}, check lại sau ${Math.floor(nextTime/60000)} phút`);
                }
            }
            
            // Kiểm tra nếu có thông tin thời gian chờ (giờ, phút, giây)
            // Ví dụ: "chờ 2 giờ 30 phút", "chờ 5 phút 30 giây", "chờ 1 giờ", "chờ 45 giây"
            let hours = 0, minutes = 0, seconds = 0;
            
            const hourMatch = message.match(/(\d+)\s*giờ/i);
            if (hourMatch) hours = parseInt(hourMatch[1]);
            
            const minuteMatch = message.match(/(\d+)\s*phút/i);
            if (minuteMatch) minutes = parseInt(minuteMatch[1]);
            
            const secondMatch = message.match(/(\d+)\s*giây/i);
            if (secondMatch) seconds = parseInt(secondMatch[1]);
            
            if (hours > 0 || minutes > 0 || seconds > 0) {
                nextTime = (hours * 3600 + minutes * 60 + seconds) * 1000;
                const timeStr = [];
                if (hours > 0) timeStr.push(`${hours} giờ`);
                if (minutes > 0) timeStr.push(`${minutes} phút`);
                if (seconds > 0) timeStr.push(`${seconds} giây`);
                console.log("duatop", `⏰ Chờ ${timeStr.join(' ')} nữa`);
            }
            
            // Kiểm tra nếu có wait_time trong response
            if (questionData.wait_time) {
                nextTime = questionData.wait_time * 1000;
            }
            
            return formatResult("duatop", {
                status: "success",
                nextTime: nextTime,
                percent: 100,
                message: `⏰ ${message}`
            });
            }
            
            // ⭐ NẾU KHÔNG CÓ ERROR, KIỂM TRA CÓ CÂU HỎI KHÔNG
            if (!questionData.question) {
            return formatResult("duatop", {
                status: "warning",
                nextTime: 300000,
                message: "❌ Không có câu hỏi"
            });
            }

            const question = questionData.question;
            const questionId = questionData.id; // ⭐ LƯU QUESTION_ID
            const answers = questionData.options || []; // ⭐ SỬA: options thay vì answers
            console.log("duatop", `❓ Câu hỏi: ${question}`);

            // 3. Tìm đáp án trong database
            const normalizedQuestion = normalizeText(question);
            let correctAnswerIndex = -1;
            let answerFound = false;

            // ⭐ LOG ĐỂ DEBUG
            console.log("duatop", `🔍 Câu hỏi đã chuẩn hóa: "${normalizedQuestion}"`);

            // Tìm trong database toàn cục
            for (const [dbQuestion, dbAnswer] of Object.entries(ANSWER_DATABASE)) {
            const normalizedDbQuestion = normalizeText(dbQuestion);
            
            if (normalizedDbQuestion === normalizedQuestion) {
                console.log("duatop", `✅ Khớp với DB: "${dbQuestion}"`);
                
                // Kiểm tra xem đáp án có trong danh sách answers không
                const matchingIndex = answers.findIndex(ans => normalizeText(ans) === normalizeText(dbAnswer));
                if (matchingIndex !== -1) {
                correctAnswerIndex = matchingIndex;
                answerFound = true;
                console.log("duatop", `✅ Tìm thấy đáp án: ${answers[matchingIndex]} (index: ${matchingIndex})`);
                } else {
                console.log("duatop", `⚠️ Có đáp án trong DB nhưng không khớp với API: ${dbAnswer}`);
                console.log("duatop", `   Đáp án chuẩn hóa: "${normalizeText(dbAnswer)}"`);
                console.log("duatop", `   Các đáp án có sẵn: ${answers.map((a, i) => `[${i}] "${normalizeText(a)}"`).join(', ')}`);
                }
                break;
            }
            }
            
            // ⭐ NẾU KHÔNG TÌM THẤY, LOG ĐỂ DEBUG
            if (!answerFound) {
            console.log("duatop", `❌ Không tìm thấy câu hỏi trong database`);
            console.log("duatop", `   Câu hỏi gốc: "${question}"`);
            console.log("duatop", `   Câu hỏi chuẩn hóa: "${normalizedQuestion}"`);
            
            // Tìm các câu hỏi tương tự trong DB (để gợi ý)
            const similarQuestions = Object.keys(ANSWER_DATABASE)
                .filter(dbQ => {
                const norm = normalizeText(dbQ);
                return norm.includes(normalizedQuestion.slice(0, 20)) || normalizedQuestion.includes(norm.slice(0, 20));
                })
                .slice(0, 3);
            
            if (similarQuestions.length > 0) {
                console.log("duatop", `   💡 Câu hỏi tương tự trong DB:`);
                similarQuestions.forEach(q => {
                console.log("duatop", `      - "${q}"`);
                console.log("duatop", `        Chuẩn hóa: "${normalizeText(q)}"`);
                });
            }
            }

            // 4. Xử lý khi không tìm thấy đáp án
            if (!answerFound) {
            // ⭐ LƯU CÂU HỎI CHƯA CÓ VÀO GLOBAL
            const missingQuestions = await store.get('global', 'duatop_missing_questions') || {};
            if (!missingQuestions[question]) {
                missingQuestions[question] = {
                answers: answers,
                firstSeen: new Date().toISOString(),
                message: null // ⭐ Chưa có message lúc này
                };
                store.set('global', 'duatop_missing_questions', missingQuestions);
                console.log("duatop", `💾 Đã lưu câu hỏi chưa có vào danh sách`);
            }
            
            // ⭐ ĐỌC CẤU HÌNH TỪ OBJECT (doiCauHoi thay vì doicauhoi)
            const config = await localStorage.getItem('taskConfig_duatop') || {};
            const doicauhoi = config.doiCauHoi !== undefined ? config.doiCauHoi : true;
            
            if (!doicauhoi) {
                // Chờ 2 phút trước khi chọn bừa
                console.log("duatop", "❌ Không tìm thấy đáp án, chờ 2 phút rồi chọn bừa");
                await new Promise(resolve => setTimeout(resolve, 120000)); // 2 phút
                console.log("duatop", "🎲 Đã chờ 2 phút, chọn câu trả lời đầu tiên");
            } else {
                console.log("duatop", "🎲 Không tìm thấy đáp án, chọn ngay câu trả lời đầu tiên");
            }

            // Chọn đáp án đầu tiên
            if (answers.length > 0) {
                correctAnswerIndex = 0;
            } else {
                return formatResult("duatop", {
                status: "warning",
                nextTime: 300000,
                message: "❌ Không có đáp án nào"
                });
            }
            }

            // 5. Gửi đáp án
            const submitRes = await queueFetch(apiUrl, {
            method: "POST",
            headers: postHeaders,
            body: JSON.stringify({
                action: "hh3d_submit_answer",
                question_id: questionId,
                selected_answer: correctAnswerIndex,
                dua_top_token: securityToken,
                _td_ts: Date.now(),
                _td_session: 100
                })
            });

            if (submitRes.status !== 200) {
                return formatResult("duatop", {
                status: "warning",
                nextTime: 60000,
                message: `❌ Không gửi được đáp án: ${submitRes.status}`
                });
            }

            const submitData = await submitRes.json();

            // ⭐ Kiểm tra nếu có correct (1 = đúng, 0 = sai)
            if (submitData.correct === 1) {
                console.log("duatop", `✅ Trả lời đúng! +${submitData.points || 0} điểm`);
                
                // ⭐ XÓA KHỎI DANH SÁCH MISSING NẾU CÓ
                const missingQuestions = await store.get('global', 'duatop_missing_questions') || {};
                if (missingQuestions[question]) {
                delete missingQuestions[question];
                await store.set('global', 'duatop_missing_questions', missingQuestions);
                }
                
                // ⭐ Gọi API lấy thời gian chờ tiếp theo
                const timeRes = await queueFetch(apiUrl, {
                method: "POST",
                headers: postHeaders,
                body: JSON.stringify({
                    action: "hh3d_get_wait_time",
                    dua_top_token: securityToken,
                    _td_ts: Date.now()
                })
                });

                let nextTime = 300000; // Mặc định 5 phút
                if (timeRes.status === 200) {
                const timeData = await timeRes.json().catch(() => null);
                if (timeData && timeData.time_remaining) {
                    // Chuyển "HH:MM:SS" thành milliseconds
                    nextTime = convertCountdownToMs(timeData.time_remaining);
                    console.log("duatop", `⏰ Câu hỏi tiếp theo sau: ${timeData.time_remaining}`);
                }
                }

                return formatResult("duatop", {
                status: "success",
                percent: 100,
                message: `✅ Đúng! +${submitData.points || 0} điểm`,
                nextTime: nextTime
                });
            } else {
                // ⭐ Trả lời sai - lưu đáp án đúng vào database
                const correctAnswerText = answers[submitData.correct_answer];
                const serverMessage = submitData.message || `Đáp án đúng: ${correctAnswerText}`;
                console.log("duatop", `❌ Trả lời sai! ${serverMessage}`);
                
                // Cập nhật database
                if (correctAnswerText) {
                ANSWER_DATABASE[question] = correctAnswerText;
                store.set('global', 'answerDatabase', ANSWER_DATABASE);
                console.log("duatop", `💾 Đã lưu đáp án đúng vào database`);
                }
                
                // ⭐ CẬP NHẬT MESSAGE VÀ CORRECT_ANSWER_INDEX CHO CÂU HỎI CHƯA CÓ
                const missingQuestions = await store.get('global', 'duatop_missing_questions') || {};
                if (missingQuestions[question]) {
                missingQuestions[question].message = serverMessage;
                missingQuestions[question].correctAnswerIndex = submitData.correct_answer;
                await store.set('global', 'duatop_missing_questions', missingQuestions);
                console.log("duatop", `💾 Đã cập nhật message cho câu hỏi chưa có`);
                }

                // ⭐ Gọi API lấy thời gian chờ tiếp theo
                const timeRes = await queueFetch(apiUrl, {
                method: "POST",
                headers: postHeaders,
                body: JSON.stringify({
                    action: "hh3d_get_wait_time",
                    dua_top_token: securityToken,
                    _td_ts: Date.now()
                })
                });

                let nextTime = 300000; // Mặc định 5 phút
                if (timeRes.status === 200) {
                const timeData = await timeRes.json().catch(() => null);
                if (timeData && timeData.time_remaining) {
                    nextTime = convertCountdownToMs(timeData.time_remaining);
                    console.log("duatop", `⏰ Câu hỏi tiếp theo sau: ${timeData.time_remaining}`);
                }
                }

                return formatResult("duatop", {
                status: "success",
                percent: 100,
                message: `❌ Sai! Đúng là: ${correctAnswerText}`,
                nextTime: nextTime
                });
            }

            } catch (err) {
            if (err.message.includes("Unauthorized")) {
                return formatResult("duatop", { 
                status: "error", 
                nextTime: 10000, 
                message: "❌ Chưa đăng nhập!" 
                });
            }
            return formatResult("duatop", { 
                status: "warning", 
                nextTime: 120000, 
                message: `❌ ${err.message}` 
            });
            }
        },

        // noel
        async noel(params) {
            const pageUrl = BASE_URL + "/event-noel-2025?t=" + Date.now();
            const apiUrl = BASE_URL + "/wp-content/themes/halimmovies-child/hh3d-ajax.php";
            try {
            const pageRes = await queueFetch(pageUrl, { method: "GET" });
            const _403 = handle403Response(pageRes, "noel");
            if (_403) return _403;
            if (pageRes.status !== 200) return formatResult("noel", { status: "warning", nextTime: 60000, message: `❌ Không tải được trang: ${pageRes.status}` });

            const html = await pageRes.text();
            
            const security_token = extractSecurityToken(html);
            
            if (!security_token) {
                console.log("noel", "❌ Không tìm thấy security token");
                return formatResult("noel", { status: "warning", message: "❌ Không tìm thấy security token", nextTime: 60000 });
            }

            // Extract remaining shakes
            const shakeCountMatch = html.match(/id=["']shake-count["'][^>]*>.*?(\d+)/i);
            let remainingShakes = shakeCountMatch ? parseInt(shakeCountMatch[1], 10) : 0;
            
            console.log("noel", `🎄 Số lần rung cây còn lại: ${remainingShakes}`);

            if (remainingShakes === 0) {
                console.log("noel", "⚠️ Đã hết lượt rung cây hôm nay");
                return formatResult("noel", { 
                status: "done", 
                percent: 100,
                message: "✅ Đã hết lượt rung cây hôm nay", 
                });
            }

            // ⭐ Rung cây theo batch (mỗi lần tối đa 5 lần)
            const MAX_SHAKES_PER_CALL = 5; // API chỉ cho phép tối đa 5 lần/lần gọi
            console.log("noel", `🎄 Bắt đầu rung cây ${remainingShakes} lần (mỗi lần tối đa ${MAX_SHAKES_PER_CALL})...`);

            const postHeaders = {
                "accept": "application/json, text/javascript, */*; q=0.01", 
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "x-requested-with": "XMLHttpRequest",
                "referer": pageUrl,
            };
            const { profileId, isLogged } = extractProfileInfo(html);
            
            // Kiểm tra trạng thái đăng nhập
            if (!isLogged) {
                return formatResult("noel", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
            }
            
            // ⭐ Rung cây theo vòng lặp, mỗi lần tối đa 5 lần
            let totalRewards = [];
            let currentRemaining = remainingShakes;
            
            while (currentRemaining > 0) {
                const shakesToDo = Math.min(currentRemaining, MAX_SHAKES_PER_CALL);
                console.log("noel", `🎄 Rung ${shakesToDo} lần...`);
                
                const shakeRes = await queueFetch(apiUrl,
                {
                    method: "POST",
                    headers: postHeaders,
                    body: `action=xoay_mnq&shakes=${shakesToDo}&security_token=${encodeURIComponent(security_token)}&user_id=${encodeURIComponent(profileId)}`
                }
                );

                if (shakeRes.status !== 200) {
                console.log("noel", `❌ Rung cây thất bại: ${shakeRes.status}`);
                
                // Nếu đã rung được một phần, vẫn trả về thành công
                if (totalRewards.length > 0) {
                    const dateKey = new Date().toLocaleDateString("vi-VN").replace(/\//g, "-");
                    const rewardKey = `noel_${dateKey}`;
                    const existingRewards = await localStorage.getItem(rewardKey) || [];
                    existingRewards.push(...totalRewards);
                    localStorage.setItem(rewardKey, existingRewards);
                    
                    const rewardSummary = totalRewards.reduce((acc, r) => {
                    acc[r.name] = (acc[r.name] || 0) + parseInt(r.quantity || 1);
                    return acc;
                    }, {});
                    const summaryText = Object.entries(rewardSummary).map(([name, qty]) => `${name} x${qty}`).join(", ");
                    
                    return formatResult("noel", { 
                    status: "warning", 
                    message: `⚠️ Rung được ${remainingShakes - currentRemaining} lần, nhận: ${summaryText}. Gặp lỗi: ${shakeRes.status}`, 
                    nextTime: 60000 
                    });
                }
                
                return formatResult("noel", { status: "warning", message: `❌ Rung cây thất bại: ${shakeRes.status}`, nextTime: 60000 });
                }

                const shakeData = await shakeRes.json();
                
                if (shakeData.success) {
                const rewards = shakeData.data?.rewards || [];
                const newRemaining = shakeData.data?.remaining_shakes || 0;
                
                // Lưu phần thưởng
                totalRewards.push(...rewards);
                
                // Log phần thưởng lần này
                const rewardsList = rewards.map(r => `${r.name} x${r.quantity}`).join(", ");
                console.log("noel", `🎁 Nhận được: ${rewardsList}`);
                console.log("noel", `🔥 Còn lại: ${newRemaining} lượt`);
                
                currentRemaining = newRemaining;
                
                // Nếu còn lượt, delay trước khi rung tiếp
                if (currentRemaining > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay 1s
                }
                } else {
                const errorMsg = shakeData.data?.message || "Lỗi không xác định";
                console.log("noel", `❌ ${errorMsg}`);
                if(errorMsg.includes("còn 0 lượt hôm nay")) {
                    break; // Thoát vòng lặp nếu hết lượt
                }
                
                // Nếu đã rung được một phần, vẫn trả về thành công
                if (totalRewards.length > 0) {
                    const dateKey = new Date().toLocaleDateString("vi-VN").replace(/\//g, "-");
                    const rewardKey = `noel_${dateKey}`;
                    const existingRewards = await localStorage.getItem(rewardKey) || [];
                    existingRewards.push(...totalRewards);
                    localStorage.setItem(rewardKey, existingRewards);
                    
                    const rewardSummary = totalRewards.reduce((acc, r) => {
                    acc[r.name] = (acc[r.name] || 0) + parseInt(r.quantity || 1);
                    return acc;
                    }, {});
                    const summaryText = Object.entries(rewardSummary).map(([name, qty]) => `${name} x${qty}`).join(", ");
                    
                    return formatResult("noel", { 
                    status: "warning", 
                    message: `⚠️ Rung được ${remainingShakes - currentRemaining} lần, nhận: ${summaryText}. Lỗi: ${errorMsg}`, 
                    nextTime: 60000 
                    });
                }
                
                return formatResult("noel", { status: "warning", message: `❌ ${errorMsg}`, nextTime: 60000 });
                }
            }
            
            // ⭐ Lưu tất cả phần thưởng vào storage
            const dateKey = new Date().toLocaleDateString("vi-VN").replace(/\//g, "-");
            const rewardKey = `noel_${dateKey}`;
            const existingRewards = await localStorage.getItem(rewardKey) || [];
            existingRewards.push(...totalRewards);
            localStorage.setItem(rewardKey, existingRewards);
            
            // Tổng hợp phần thưởng
            const rewardSummary = totalRewards.reduce((acc, r) => {
                acc[r.name] = (acc[r.name] || 0) + parseInt(r.quantity || 1);
                return acc;
            }, {});
            const summaryText = Object.entries(rewardSummary).map(([name, qty]) => `${name} x${qty}`).join(", ");
            
            return formatResult("noel", { 
                status: "done", 
                percent: 100,
                message: `✅ Đã rung hết ${remainingShakes} lần! 🎁 ${summaryText}`, 
            });

            } catch (err) {
            console.log("noel", `❌ Lỗi: ${err.message}`);
            if(err.message.includes("Unauthorized")) {
                return formatResult("noel", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập!" });
            }  
            return formatResult("noel", { status: "warning", message: `❌ Lỗi: ${err.message}`, nextTime: 60000 });
            }
        },

        // đua top
        async trungthu(params) {
            const pageUrl = BASE_URL + "/event-trung-thu-2025?t=1493d";
            const apiUrl = BASE_URL + "/wp-content/themes/halimmovies-child/hh3d-ajax.php";
            
            try {
            // lấy html
            const resPage = await queueFetch(pageUrl, { method: "GET",
                headers: {
                "accept": "text/html",
                }
            });
            const html = await resPage.text();

            const _403 = handle403Response(resPage, "trungthu");
            if (_403) return _403;
            const tokens = extractActionTokens(html);
            const security = tokens['xoay_mnq'];
            let items = [];
            if (!security) {
                return formatResult("trungthu", { status:"warning", nextTime:60000, message:"❌ Không thể lấy token" });
            }
            const postHeaders = { 
                "accept": "application/json, text/javascript, */*; q=0.01",
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "x-requested-with": "XMLHttpRequest",
                "referer": pageUrl,
            };
            const resItem = await queueFetch(apiUrl, {
                method: "POST", headers: postHeaders,
                body: `action=fetch_gift_items`
            });
            const itemJson = await resItem.json().catch(() => null);
            if (itemJson?.success) {
                items = itemJson?.data?.items || [];
            }
            console.log("trungthu", `🎁 Có ${items.length} vật phẩm trong kho.`);
            console.log("trungthu", `🎁 Vật phẩm: ${items.map(i => `${i.name} x${i.quantity}`).join(", ")}`);
            const res = await queueFetch(apiUrl, { 
                method: "POST", headers: postHeaders,
                body: `action=xoay_mnq&shakes=5&security=${security}`      
            });
            const data = await res.json().catch(() => null);
            if (!data?.success) {
                return formatResult("trungthu", { status:"done", nextTime:0, percent: 100,  data: { items } , message:`❌ ${data?.data?.message || data?.data || data?.error || "Thất bại"}` });
            }
            const rewards = data?.data?.rewards || [];
            const formattedRewards = rewards.map(reward => {
                const rarity = reward.is_rare ? "✨ Hiếm" : "";
                return `- ${reward.name} x${reward.quantity} ${rarity}`;
            }).join('\n');

            return formatResult("trungthu", { 
                status: "done", 
                percent: 100,
                nextTime: 0,
                message: `🎉 Phần thưởng:\n${formattedRewards}`,
                data: { rewards, items }
            });
            } catch (err) {
            if(err.message.includes("Unauthorized")) {
                return formatResult("trungthu", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập!" });
            }
            return formatResult("trungthu", { status:"warning", nextTime:120000, message:`❌ ${err.message}` });
            }
        },

        // bí cảnh
        async bicanh(params) {
            const pageUrl = BASE_URL + "/bi-canh-tong-mon?t=78cb3";
            const apiCheckUrl = BASE_URL + "/wp-json/tong-mon/v1/check-attack-cooldown";
            const apiAttackUrl = BASE_URL + "/wp-json/tong-mon/v1/attack-boss";
            const apiContributeUrl = BASE_URL + "/wp-json/tong-mon/v1/contribute-boss";
            const apiClaimRewardUrl = BASE_URL + "/wp-json/tong-mon/v1/claim-boss-reward";
            try {
            // lấy html
            const resPage = await queueFetch(pageUrl, { method: "GET",
                headers: {
                "accept": "text/html",
                }
            });
            const html = await resPage.text();
            const _403 = handle403Response(resPage, "bicanh");
            if (_403) return _403;
            const resNonce = extractWpNonce(html);
            if (!resNonce) {
                return formatResult("bicanh", { status:"warning", nextTime:60000, percent:0, message:"❌ Không thể lấy token" });
            }

            const postHeaders = { 
                "accept": "application/json, text/javascript, */*; q=0.01",
                "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
                "x-requested-with": "XMLHttpRequest",
                "x-wp-nonce": resNonce,
                "referer": pageUrl,
            };
            // kiểm tra có phải hiến tế không
            const resContribute = await queueFetch(apiContributeUrl, {
                method: "POST", headers: postHeaders,
                body: JSON.stringify({})
            });
            const contributeJson = await resContribute.json().catch(() => null);
            if (!contributeJson?.success || contributeJson?.code === 'boss_active') {
                // console.log("bicanh", `❌: ${ contributeJson?.message || contributeJson?.data || "Thất bại"}`);
            } else {
                console.log("bicanh", `✅: ${ contributeJson?.message || contributeJson?.data || "Thành công"}`);
            }
            // Kiểm tra nhận thưởng bí cảnh 
            const resClaim = await queueFetch(apiClaimRewardUrl, {
                method: "POST", 
                headers: postHeaders,
                body: JSON.stringify({})
            });

            const claimJson = await resClaim.json().catch(() => null);

            if (!claimJson?.success || claimJson?.code === 'no_reward') {
                // console.log("bicanh", `❌: ${claimJson?.message || "Thất bại"}`);
            } else {
                console.log("bicanh", `🏆: ${claimJson?.message || "Thành công"}`);
                    
                return formatResult("bicanh", { 
                status: "success", 
                nextTime: 10000, 
                percent: 100, 
                message: `🏆 Phần thưởng nhận được: ${claimJson?.message || "Thành công"}`
                });
            }
            // bí cảnh kiểm tra thời gian tấn công
            const res = await queueFetch(apiCheckUrl, { method: "POST", headers: postHeaders });
            const data = await res.json().catch(() => null);
            if (!data?.success) {
                return formatResult("bicanh", { status:"warning", nextTime:60000, percent:0, message:`❌ ${data?.data?.message || data?.data || data?.error || "Thất bại"}` });
            }
            // Load limit from renderer settings key `bicanh_boss_attacks` (supports {limit: n} or legacy number)
            const savedBicanh = await localStorage.getItem("bicanh_boss_attacks");
            let limit_attack = 5;
            if (savedBicanh !== undefined && savedBicanh !== null) {
                if (typeof savedBicanh === 'object') {
                limit_attack = parseInt(savedBicanh.limit) || 5;
                } else {
                limit_attack = parseInt(savedBicanh) || 5;
                }
            }
            const max_attack = 5;
            // console.log({ data });
            if(data?.can_attack) {
                // kiểm tra giới hạn tấn công để xem có thể tấn công tiếp không
                const remaining = parseInt(data?.remaining_attacks || 5);
                // console.log({ remaining, limit_attack, max_attack });
                if(remaining <= (max_attack - limit_attack)) {
                const percent = (max_attack - remaining) / 5 * 100;
                return formatResult("bicanh", { status:"success", nextTime:30 *60 *1000, percent:percent, message:`✅ Đã đạt giới hạn tấn công hôm nay: ${limit_attack}/${max_attack} (còn lại ${remaining})` });
                }
                console.log("bicanh", `⚔️ Có thể vào tấn công Boss`);
                // tiến hành tấn công
                const resAttack = await queueFetch(apiAttackUrl, { method: "POST", headers: postHeaders });
                const attackJson = await resAttack.json().catch(() => null);
                const percent = Math.round((1 - parseInt(attackJson?.attack_info?.remaining || 0) / 5) * 100) || 0;
                if (!attackJson?.success) {
                return formatResult("bicanh", { status:"warning", nextTime:60000, percent, message:`❌ ${attackJson?.message || attackJson?.error || "Thất bại"}` });
                }
                return formatResult("bicanh", { status:"success", nextTime:7 * 60 *1000, percent, message: `✅  ${attackJson?.message || "Thành công"}` });
            } else{
                const minute = Math.floor(data?.minutes || 6);
                const seconds = Math.floor(data?.seconds || 59);
                const nextTime = (minute * 60 + seconds) * 1000 + 2000;
                const remaining = parseInt(data?.remaining_attacks || 0);
                const percent = (max_attack - remaining) / 5 * 100;
                // console.log("Thông số: ", remaining, limit_attack, max_attack);
                if(remaining <= (max_attack - limit_attack)) {
                return formatResult("bicanh", { status:"success", nextTime:30 *60 *1000, percent, message:`✅ Đã đạt giới hạn tấn công hôm nay: ${limit_attack}/${max_attack} (còn lại ${remaining})` });
                }
                if(remaining<= 0 ) {        
                return formatResult("bicanh", { status:"success", nextTime:30 *60 *1000, percent:100, message:`✅: ${data?.message}` });
                }
                return formatResult("bicanh", { status:"success", nextTime:nextTime, percent, message:`⏳: ${data?.message || `Chưa thể tấn công, thời gian chờ ${minute} phút ${seconds} giây`}` });
            }
            } catch (err) {
            if(err.message.includes("Unauthorized")) {
                return formatResult("bicanh", { status:"error", nextTime:10000, percent:0, message:"❌ Chưa đăng nhập!" });
            }
            return formatResult("bicanh", { status:"warning", nextTime:60000, percent:0, message:`❌ ${err.message}` });
            }
        },
        // tặng quà
        async tangqua(params) {
            const { targetIds = [], giftMethod = "xu", types = {} } = params;
            
            if (!Array.isArray(targetIds) || targetIds.length === 0) {
            return formatResult("tangqua", { 
                status: "error", 
                nextTime: 10000, 
                percent: 0, 
                message: "❌ Chưa cài đặt người nhận" 
            });
            }
            
            const pageUrl = BASE_URL + "/tien-duyen?t=5af4d";
            const apiUrl = BASE_URL + "/wp-json/hh3d/v1/action";
            
            try {
            // Lấy html và nonce
            const resPage = await queueFetch(pageUrl, { method: "GET",
                headers: {
                "accept": "text/html",
                }
            });
            const html = await resPage.text();
            const { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role, isLogged } = extractProfileInfo(html);
            
            // Kiểm tra trạng thái đăng nhập
            if (!isLogged) {
                return formatResult("tangqua", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập" });
            }
            
            const nonce = extractWpRestNonce(html);
            
            if (!nonce) {
                return formatResult("tangqua", { 
                status: "warning", 
                nextTime: 60000, 
                percent: 0, 
                message: "❌ Không thể lấy token" 
                });
            }
            
            const postHeaders = {
                "accept": "application/json, text/javascript, */*; q=0.01",
                "content-type": "application/json",
                "x-requested-with": "XMLHttpRequest",
                "x-wp-nonce": nonce,
                "referer": pageUrl,
            };
            
            let messages = [];
            let totalGifts = 0;
            let successGifts = 0;
            // ⭐ THÊM HÀNH ĐỘNG ƯỚC NGUYỆN ĐẦU TIÊN
            console.log("tangqua", "🌸 Kiểm tra trạng thái cây ước nguyện...");

            try {
                // Kiểm tra trạng thái cây ước nguyện
                const resCheckWish = await queueFetch(apiUrl, {
                method: "POST",
                headers: postHeaders,
                body: JSON.stringify({
                    action: "check_wish_tree_status"
                })
                });
                
                const checkWishData = await resCheckWish.json().catch(() => null);
                
                if (checkWishData?.can_wish === true) {
                console.log("tangqua", "🌟 Có thể ước nguyện - đang thực hiện...");
                
                await wait(1000);
                
                // Thực hiện ước nguyện
                const resMakeWish = await queueFetch(apiUrl, {
                    method: "POST",
                    headers: postHeaders,
                    body: JSON.stringify({
                    action: "make_wish_tree"
                    })
                });
                
                const makeWishData = await resMakeWish.json().catch(() => null);
                
                if (makeWishData?.success === true) {
                    let wishMessage = "🌸 Ước nguyện thành công!";
                    
                    // Lấy thông tin từ response
                    const points = makeWishData.points || 0;
                    const tamSinhThach = makeWishData.tam_sinh_thach || 0;
                    const wishText = makeWishData.wish_message || "";
                    const status = makeWishData.status || "";
                    
                    if (status === 'both_completed') {
                    // Cả hai đã hoàn thành ước nguyện
                    wishMessage += `\n🎉 Cả hai đã hoàn thành ước nguyện!`;
                    wishMessage += `\n✨ Tổng cộng nhận được:`;
                    wishMessage += `\n💖 ${makeWishData.total_points || points} Điểm Thân Mật`;
                    wishMessage += `\n🎋 ${makeWishData.total_tam_sinh_thach || tamSinhThach} Tam Sinh Thạch`;
                    
                    } else {
                    // Chỉ mình hoàn thành hoặc first_wish, chờ đạo lữ
                    wishMessage += `\n💖 Nhận được: ${points} Điểm Thân Mật`;
                    wishMessage += `\n🎋 Nhận được: ${tamSinhThach} Tam Sinh Thạch`;
                    
                    if (status === 'first_wish') {
                        wishMessage += `\n⏳ Đang chờ đạo lữ ước nguyện...`;
                    }
                    }
                    
                    // Thêm thông điệp ước nguyện nếu có
                    if (wishText) {
                    wishMessage += `\n📜 Lời ước: "${wishText}"`;
                    }
                    
                    // Thêm message từ server nếu có
                    if (makeWishData.message && makeWishData.message !== wishText) {
                    wishMessage += `\n💬 ${makeWishData.message}`;
                    }
                    
                    console.log("tangqua", wishMessage);
                    messages.push(wishMessage);
                } else {
                    const errorMsg = makeWishData?.message || "Ước nguyện thất bại";
                    console.log("tangqua", `❌ ${errorMsg}`);
                    messages.push(`❌ Ước nguyện: ${errorMsg}`);
                }
                } else if (checkWishData?.can_wish === false) {
                // Không thể ước nguyện - hiển thị thông tin trạng thái
                let statusMsg = "⚠️ Không thể ước nguyện: ";
                
                const status = checkWishData.status;
                const points = checkWishData.points;
                const tamSinhThach = checkWishData.tam_sinh_thach;
                const message = checkWishData.message;
                
                if (status === 'completed') {
                    // Đã hoàn thành
                    const totalPoints = checkWishData.total_points || points;
                    const totalTamSinhThach = checkWishData.total_tam_sinh_thach || tamSinhThach;
                    statusMsg += `Đã hoàn thành hôm nay (${totalPoints} điểm thân mật, ${totalTamSinhThach} Tam Sinh Thạch)`;
                } else if (status === 'user_wished') {
                    // Đã ước nguyện, đang chờ đạo lữ
                    statusMsg += `Đã ước nguyện, đang chờ đạo lữ (${points} điểm thân mật, ${tamSinhThach} Tam Sinh Thạch)`;
                } else if (status === 'partner_waiting') {
                    // Đạo lữ đã ước nguyện, chờ mình
                    const partnerPoints = checkWishData.partner_points || 0;
                    const partnerTamSinhThach = checkWishData.partner_tam_sinh_thach || 0;
                    statusMsg += `Đạo lữ đã ước nguyện (${partnerPoints} điểm thân mật, ${partnerTamSinhThach} Tam Sinh Thạch) - Hãy ước nguyện để hoàn thành!`;
                } else if (checkWishData.reason === 'no_partner') {
                    statusMsg += "Chưa có đạo lữ";
                } else {
                    statusMsg += message || "Không rõ lý do";
                }
                
                console.log("tangqua", statusMsg);
                messages.push(statusMsg);
                } else {
                // Lỗi khi check hoặc response không hợp lệ
                const errorMsg = checkWishData?.message || "Lỗi kiểm tra cây ước nguyện";
                console.log("tangqua", `⚠️ ${errorMsg}`);
                messages.push(`⚠️ Ước nguyện: ${errorMsg}`);
                }
            } catch (wishError) {
                console.log("tangqua", `❌ Lỗi ước nguyện: ${wishError.message}`);
                messages.push(`❌ Lỗi ước nguyện: ${wishError.message}`);
            }
            // Đợi một chút trước khi chuyển sang tặng quà
            await wait(500);
            
            // ⭐ TIẾP TỤC PHẦN TẶNG QUÀ NHƯ CŨ
            console.log("tangqua", "🎁 Bắt đầu tặng quà...");
            // Xử lý từng ID trong targetIds
            for (const userId of targetIds) {
                if (!userId || isNaN(userId) || parseInt(userId) <= 0) {
                messages.push(`⚠️ Bỏ qua ID không hợp lệ: ${userId}`);
                continue;
                }
                
                // Lấy phương thức tặng quà cho user này (từ types hoặc fallback về giftMethod chung)
                const giftType = types[userId] || giftMethod;
                const costType = giftType === "tienngoc" ? "tien_ngoc" : "xu";
                const giftName = giftType === "tienngoc" ? "🔮 Tiên Ngọc" : "🪙 Xu";
                
                console.log("tangqua", `🎁 Tặng quà cho ID ${userId} bằng ${giftName}...`);

                // Tặng 5 lần cho mỗi người
                for (let i = 0; i < 5; i++) {
                totalGifts++;
                await wait(500);
                
                try {
                    const res = await queueFetch(apiUrl, {
                    method: "POST",
                    headers: postHeaders,
                    body: JSON.stringify({
                        action: "gift_to_friend",
                        friend_id: parseInt(userId),
                        gift_type: "hoa_hong", // Loại quà cố định
                        cost_type: costType
                    })
                    });
                    
                    const data = await res.json().catch(() => null);
                    
                    if (!data?.success) {
                    const errorMsg = data?.message || data?.data || "Lỗi không xác định";
                    messages.push(`❌ ID ${userId} lần ${i+1}: ${errorMsg}`);
                    console.log("tangqua", `❌ ID ${userId} lần ${i+1}: ${errorMsg}`);
                    
                    // Nếu đã gửi tối đa cho user này thì dừng lại
                    if (errorMsg.includes("Đã gửi tối đa") || errorMsg.includes("tối đa")) {
                        totalGifts--; // Không tính lần này vào tổng
                        console.log("tangqua", `⚠️ Đã gửi tối đa cho ID ${userId}, chuyển sang người tiếp theo`);
                        break;
                    }
                    } else {
                    successGifts++;
                    const successMsg = data?.message || "Tặng quà thành công";
                    messages.push(`✅ ID ${userId} lần ${i+1}: ${successMsg}`);
                    console.log("tangqua", `✅ ID ${userId} lần ${i+1}: ${successMsg}`);
                    }
                } catch (error) {
                    messages.push(`❌ ID ${userId} lần ${i+1}: Lỗi kết nối - ${error.message}`);
                    console.log("tangqua", `❌ ID ${userId} lần ${i+1}: Lỗi kết nối - ${error.message}`);
                }
                }
                
                // Đợi trước khi chuyển sang user tiếp theo
                if (targetIds.indexOf(userId) < targetIds.length - 1) {
                await wait(1000);
                }
            }
            
            const percent = totalGifts > 0 ? Math.floor((successGifts / totalGifts) * 100) : 0;
            const status = successGifts > 0 ? "done" : "error";
            
            // Tóm tắt kết quả
            const summary = `🎁 Tặng quà hoàn tất: ${successGifts}/${totalGifts} thành công`;
            const finalMessage = [summary, ...messages].join("\n");
            const date = new Date().toISOString().slice(0,10);
            const timestamp = Date.now();
            const key = `tangqua_${date}`;
            localStorage.setItem(key, `${timestamp}: ${finalMessage}`);
            return formatResult("tangqua", {
                status: status,
                nextTime: 0,
                percent: percent,
                message: finalMessage,
                data: { profileId, userName, avatarUrl, tuVi, tinhThach, tienNgoc, tongmon, role }
            });
            
            } catch (err) {
            if (err.message.includes("Unauthorized")) {
                return formatResult("tangqua", { 
                status: "error", 
                nextTime: 10000, 
                percent: 0, 
                message: "❌ Chưa đăng nhập!" 
                });
            }
            return formatResult("tangqua", { 
                status: "error", 
                nextTime: 10000, 
                percent: 0, 
                message: `❌ ${err.message}` 
            });
            }
        },
        async linhthach(params) {
            const code = params.code;
            if (!code) {
            return formatResult("linhthach", { status:"error", nextTime:10000, message:"❌ Vui lòng nhập code hợp lệ" });
            }
            const pageUrl = BASE_URL + "/linh-thach?t=e14fa";
            const apiUrl = BASE_URL + "/wp-content/themes/halimmovies-child/hh3d-ajax.php";
            try {
                // lấy html
            const resPage = await queueFetch(pageUrl, { method: "GET",
                headers: {
                "accept": "text/html",
                }
            });
            const html = await resPage.text();
            const tokens = extractActionTokens(html);
            const nonce = tokens["redeem_linh_thach"];
            if (!nonce) {
                return formatResult("linhthach", { status:"warning", nextTime:60000, message:"❌ Không thể lấy token" });
            }
            const postHeaders = { 
                "accept": "application/json",
                "content-type": "application/x-www-form-urlencoded",
                "x-requested-with": "XMLHttpRequest",
                "referer": pageUrl,
            };
            const hold_timestamp = Math.floor(Date.now() / 1000);
            // gửi yêu cầu hấp thụ linh thạch
            const res = await queueFetch(apiUrl, {
                method: "POST",
                headers: postHeaders,
                body: `action=redeem_linh_thach&code=${code}&nonce=${nonce}&hold_timestamp=${hold_timestamp}`
            });

            const data = await res.json().catch(() => null);
            if (!data?.success) {
                return formatResult("linhthach", { status:"error", nextTime:10000, message:`❌ ${data?.data?.message || data?.data || data?.error || "Thất bại"}` });
            }
            return formatResult("linhthach", { status:"done", nextTime:0, message: `✅  ${data?.data?.message || data?.data || data?.error || "Thành công"}` });
            } catch (err) {
            if(err.message.includes("Unauthorized")) {
                return formatResult("linhthach", { status:"error", nextTime:10000, message:"❌ Chưa đăng nhập!" });
            }
            return formatResult("linhthach", { status:"warning", nextTime:120000, message:`❌ ${err.message}` });
            }
        },  
};

    // ============================================================================
    // TASK SCHEDULER
    // ============================================================================
    class TaskScheduler {
        constructor() {
            this.isRunning = false;
            this.taskResults = {};
            this.taskStates = {};
            this.interval = null;
        }

        async init() {
            // Load saved states
            const data = await Storage.get(['isRunning', 'taskResults', 'taskStates']);
            this.isRunning = data.isRunning || false;
            this.taskResults = data.taskResults || {};
            this.taskStates = data.taskStates || {
                checkin: true,
                phucloi: true,
                vandap: true,
                luanvo: false,
                // ... other tasks
            };
        }

        async start() {
            this.isRunning = true;
            await Storage.set({ isRunning: true });
            this.runAllTasks();
            this.interval = setInterval(() => this.checkAndRun(), 30000);
        }

        async stop() {
            this.isRunning = false;
            await Storage.set({ isRunning: false });
            if (this.interval) clearInterval(this.interval);
        }

        async runAllTasks() {
            for (const taskKey in this.taskStates) {
                if (this.taskStates[taskKey] && TASKS[taskKey]) {
                    await this.runTask(taskKey);
                    await wait(2000);
                }
            }
        }

        async runTask(taskKey) {
            if (!TASKS[taskKey]) return;
            
            console.log(`▶️ Running task: ${taskKey}`);
            const result = await TASKS[taskKey]();
            
            this.taskResults[taskKey] = result;
            await Storage.set({ taskResults: this.taskResults });
            
            console.log(`✅ Task ${taskKey} completed:`, result.message);
            
            // Schedule next run
            if (result.nextTime > 0) {
                setTimeout(() => this.runTask(taskKey), result.nextTime);
            }
        }

        async checkAndRun() {
            if (!this.isRunning) return;
            
            const now = Date.now();
            for (const taskKey in this.taskResults) {
                const task = this.taskResults[taskKey];
                if (task.nextTime && task.timestamp + task.nextTime <= now) {
                    await this.runTask(taskKey);
                    await wait(2000);
                }
            }
        }
    }

    // ============================================================================
    // UI - FLOATING PANEL
    // ============================================================================
    function createUI() {
        const panel = document.createElement('div');
        panel.id = 'hh3d-tool-panel';
        panel.innerHTML = `
            <style>
                #hh3d-tool-panel {
                    position: fixed;
                    top: 50%;
                    right: 0;
                    transform: translateY(-50%);
                    width: 300px;
                    max-height: 80vh;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border-radius: 10px 0 0 10px;
                    box-shadow: -2px 0 10px rgba(0,0,0,0.3);
                    z-index: 999999;
                    font-family: Arial, sans-serif;
                    overflow: hidden;
                    transition: right 0.3s ease;
                }
                #hh3d-tool-panel.collapsed {
                    right: -280px;
                }
                .panel-header {
                    background: rgba(0,0,0,0.2);
                    padding: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                }
                .panel-title {
                    color: white;
                    font-weight: bold;
                    font-size: 14px;
                }
                .panel-toggle {
                    background: white;
                    color: #667eea;
                    border: none;
                    padding: 5px 10px;
                    border-radius: 5px;
                    cursor: pointer;
                    font-size: 12px;
                }
                .panel-content {
                    padding: 10px;
                    max-height: calc(80vh - 50px);
                    overflow-y: auto;
                }
                .control-btn {
                    width: 100%;
                    padding: 10px;
                    margin: 5px 0;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                    font-weight: bold;
                    transition: opacity 0.2s;
                }
                .control-btn:hover {
                    opacity: 0.8;
                }
                .btn-start {
                    background: #4CAF50;
                    color: white;
                }
                .btn-stop {
                    background: #f44336;
                    color: white;
                }
                .task-item {
                    background: white;
                    padding: 10px;
                    margin: 5px 0;
                    border-radius: 5px;
                    font-size: 12px;
                }
                .task-name {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .task-status {
                    color: #666;
                }
                .status-success { color: #4CAF50; }
                .status-error { color: #f44336; }
                .status-warning { color: #ff9800; }
                .status-pending { color: #2196F3; }
            </style>
            <div class="panel-header">
                <span class="panel-title">🎮 HH3D Tool</span>
                <button class="panel-toggle" onclick="this.closest('#hh3d-tool-panel').classList.toggle('collapsed')">◀</button>
            </div>
            <div class="panel-content">
                <button class="control-btn btn-start" id="btn-start">▶️ Start All</button>
                <button class="control-btn btn-stop" id="btn-stop">⏹️ Stop All</button>
                <div id="task-list"></div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Bind events
        document.getElementById('btn-start').onclick = () => scheduler.start();
        document.getElementById('btn-stop').onclick = () => scheduler.stop();
        
        // Update task list periodically
        setInterval(updateTaskList, 1000);
    }

    function updateTaskList() {
        const taskList = document.getElementById('task-list');
        if (!taskList) return;
        
        const tasks = scheduler.taskResults;
        let html = '';
        
        for (const [key, task] of Object.entries(tasks)) {
            html += `
                <div class="task-item">
                    <div class="task-name">${key}</div>
                    <div class="task-status status-${task.status}">
                        ${task.message}
                    </div>
                </div>
            `;
        }
        
        taskList.innerHTML = html || '<div class="task-item">Chưa có task nào</div>';
    }

    // ============================================================================
    // INITIALIZATION
    // ============================================================================
    const scheduler = new TaskScheduler();
    
    async function init() {
        console.log('🚀 Initializing HH3D Tool Userscript...');
        
        await scheduler.init();
        createUI();
        
        // Auto-start if was running
        if (scheduler.isRunning) {
            scheduler.start();
        }
        
        console.log('✅ HH3D Tool Userscript Ready!');
    }

    // Wait for DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
