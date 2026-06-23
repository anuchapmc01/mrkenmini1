const express = require('express');
const puppeteer = require('puppeteer');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;
const webhookUrl = 'วาง_WEBHOOK_URL_ของ_MAKE_ตรงนี้';

let browser;
let page;

// 1. เปิด Web Server ให้คุณเข้ามาดูหน้าจอของบอทเพื่อสแกน QR Code
app.get('/', async (req, res) => {
    if (!page) return res.send('<h1>⏳ รอสักครู่ บอทกำลังเปิดเบราว์เซอร์...</h1>');
    
    try {
        // ถ่ายภาพหน้าจอปัจจุบันของบอท
        const screenshot = await page.screenshot({ encoding: 'base64' });
        res.send(`
            <h2>📱 สแกน QR Code เพื่อล็อกอินเข้า LINE</h2>
            <img src="data:image/png;base64,${screenshot}" style="max-width: 800px; border: 1px solid #ccc;" />
            <p>รีเฟรชหน้านี้เพื่อดูหน้าจอล่าสุด หากสแกนสำเร็จภาพจะเปลี่ยนเป็นหน้าแชท</p>
        `);
    } catch (error) {
        res.send('กำลังโหลดภาพหน้าจอ...');
    }
});

async function startBot() {
    console.log("🚀 กำลังเปิดเบราว์เซอร์บนคลาวด์...");
    
    // ตั้งค่า Puppeteer สำหรับรันบนคลาวด์
    browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // โค้ดจำเป็นสำหรับ Railway
    });
    
    page = await browser.newPage();
    
    // ตั้งค่าขนาดหน้าจอให้กว้างพอที่จะเห็นแชท
    await page.setViewport({ width: 1280, height: 800 });
    
    // 2. ให้บอทวิ่งไปที่หน้าล็อกอินของ LINE
    // *หมายเหตุ: ตรงนี้เป็น URL สมมติสำหรับหน้าล็อกอิน LINE Web หรือ Extension
    await page.goto('https://access.line.me/oauth2/v2.1/login'); 
    
    console.log("✅ เปิดหน้าเว็บสำเร็จ! เข้าไปที่ลิงก์ Railway ของคุณเพื่อสแกน QR Code ได้เลย");

    // 3. ลูปดักจับข้อความแชท (ทำงานต่อเนื่องหลังล็อกอินสำเร็จ)
    setInterval(async () => {
        try {
            // โค้ดส่วนนี้คือการจำลองการอ่าน DOM บนหน้าเว็บ LINE 
            // จะต้องใช้ CSS Selector ที่ตรงกับโครงสร้างของ LINE จริง
            const newOrder = await page.evaluate(() => {
                const chatBox = document.querySelector('.chat-message-text'); 
                if (chatBox) {
                    const text = chatBox.innerText;
                    // ล้างข้อความทิ้งเพื่อไม่ให้ดึงซ้ำ (จำลอง)
                    chatBox.remove(); 
                    return text;
                }
                return null;
            });

            if (newOrder) {
                console.log("📨 พบข้อความใหม่! กำลังส่งข้อมูลไป Make.com...");
                await axios.post(webhookUrl, { 
                    customerName: "ลูกค้าจาก LINE ตัวจริง",
                    message: newOrder
                });
            }
        } catch (error) {
            // หากยังไม่ล็อกอิน หรือหาช่องแชทไม่เจอ ระบบจะเงียบไว้เพื่อรอรอบถัดไป
        }
    }, 5000); // เช็กแชททุกๆ 5 วินาที
}

// สั่งรันเซิร์ฟเวอร์
app.listen(port, () => {
    console.log(`🌐 Web Server เปิดทำงานแล้วที่พอร์ต ${port}`);
    startBot();
});