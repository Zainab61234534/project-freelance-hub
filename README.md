# FreelanceHub

## التشغيل
1. انسخ `.env.example` إلى `.env` ثم عدِّل القيم.
2. ثبّت الاعتماديات:
   ```bash
   npm install
   ```
3. أنشئ قاعدة البيانات وولِّد Prisma client:
   ```bash
   npx prisma migrate dev
   npx prisma generate
   ```
4. شغّل التطبيق:
   ```bash
   npm run start:dev
   ```

## Postman
- استورد `FreelanceHub.postman_collection.json` و`FreelanceHub.postman_environment.json`.
- رتّب التشغيل: Auth ← Freelancer Profile ← Categories ← Projects ← Wallet ← Offers ← Deliveries ← Admin.
- مجلد Admin يعمل آخراً لأنه يحظر حساب المستقل مؤقتاً.
- عدِّل `categoryId` في البيئة ليطابق تصنيفاً موجوداً في قاعدة بياناتك، أو أنشئ تصنيفاً من مجلد Categories ثم ضع الـ id.
- يجب أن تطابق قيمة `adminPassword` قيمة `ADMIN_PASSWORD` في `.env`.
- تسجيل الدخول محدود بـ 5 محاولات في الدقيقة لكل IP، لذا شغّل المجلدات على دفعات.

## متغيرات البيئة
- DATABASE_URL
- ADMIN_PASSWORD
- PORT
- NODE_ENV
- FRONTEND_ORIGIN
- TRUST_PROXY

## الأدوار
- ADMIN
- CLIENT
- FREELANCER

## نقاط الدخول الأساسية
### Auth
- POST /auth/register
- POST /auth/login
- POST /auth/logout
- POST /auth/logout-all
- GET /auth/me

### Categories
- GET /categories
- GET /categories/:id
- POST /categories
- PATCH /categories/:id
- DELETE /categories/:id

### Projects
- POST /projects
- GET /projects
- GET /projects/:id
- PATCH /projects/:id
- DELETE /projects/:id

### Offers
- POST /offers/projects/:projectId
- GET /offers/my
- GET /offers/projects/:projectId
- PATCH /offers/:offerId
- POST /offers/projects/:projectId/accept/:offerId

### Wallet
- GET /wallet/me
- GET /wallet/transactions
- POST /wallet/deposit

### Deliveries
- POST /deliveries/projects/:projectId
- PATCH /deliveries/:deliveryId/review

### Freelancer profile
- POST /freelancer-profile
- GET /freelancer-profile/me
- PATCH /freelancer-profile/me

### Admin
- PATCH /admin/users/:userId/ban
- PATCH /admin/users/:userId/unban

## أدوار المطلوب لكل endpoint
- العميل: إنشاء المشاريع، قبول العروض، الإيداع.
- المستقل: إنشاء الملف الشخصي، عروض المشاريع، رفع التسليمات.
- المدير: إدارة المستخدمين والتصنيفات.

## نموذج استجابة المشروع
```json
{
  "id": "uuid",
  "title": "Project title",
  "description": "Project description",
  "budget": "1500.00",
  "status": "OPEN",
  "attachmentUrl": "/uploads/projects/uuid.png"
}
```

## نموذج ملف المستقل
```json
{
  "id": "uuid",
  "profileImage": "/uploads/freelancer-profiles/uuid.jpg",
  "bio": "Senior developer",
  "hourlyRate": "60.00"
}
```
