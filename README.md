# PocketSchool Phase 2 - File Upload System

> এই প্রজেক্টে ব্যবহৃত প্রতিটি concept, tool এবং keyword এর বিস্তারিত ব্যাখ্যা।

---

## Project Structure

```
pocketschool-phase2/
├── index.js                        # Entry point - server start
├── package.json                    # Dependencies
├── .env                            # Environment variables (secret keys)
├── public/
│   ├── simulation.html             # Upload visualization (শেখার জন্য)
│   └── uploads/                    # Temporary file storage
└── src/
    ├── app.js                      # Express app setup
    ├── config/
    │   ├── index.js                # Port config
    │   └── spaces.js               # DigitalOcean S3 config
    ├── middleware/
    │   ├── fileTypeValidator.js    # MIME type + extension check
    │   └── rate-limit.js           # Rate limiting
    ├── routes/
    │   ├── index.js                # Home route
    │   └── upload.js               # Upload routes + Multer setup
    └── services/
        ├── spacesUploader.js       # S3 upload logic
        └── uploadQueue.js          # Background upload queue
```

---

## সম্পূর্ণ Upload Flow (শুরু থেকে শেষ)

```
Browser → FormData → HTTP Request → Express → Multer → Disk → Queue → S3 (Cloud)
```

```
১. User ফাইল select করে (browser)
২. Browser FormData তৈরি করে, multipart/form-data হিসেবে encode করে
৩. HTTP POST request পাঠায় boundary সহ
৪. Express server request receive করে
৫. Multer middleware multipart data parse করে, file extract করে
৬. fileTypeValidator MIME type ও extension check করে
৭. Rate limiter check করে (too many requests কিনা)
৮. File locally save হয় /public/uploads/ এ
৯. Client কে immediately response পাঠানো হয় (fast!)
১০. Background এ queue ফাইলটি S3/Spaces এ upload করে
১১. Local temporary file delete হয়ে যায়
```

---

## Keywords & Concepts বিস্তারিত ব্যাখ্যা

---

### MIME Type (Multipurpose Internet Mail Extensions)

**MIME Type কী?**
MIME Type হলো একটা label যেটা বলে দেয় একটা file আসলে কী ধরনের। ঠিক যেমন মানুষের নামের পরে "ডাক্তার" বা "ইঞ্জিনিয়ার" লেখা থাকলে বোঝা যায় সে কী করে — তেমনি MIME Type দেখে browser/server বোঝে file টা কী।

**Format:** `type/subtype`

| MIME Type | মানে |
|-----------|------|
| `image/jpeg` | JPEG ইমেজ (.jpg, .jpeg) |
| `image/png` | PNG ইমেজ (.png) |
| `image/webp` | WebP ইমেজ (.webp) |
| `application/json` | JSON data |
| `text/html` | HTML file |
| `application/pdf` | PDF file |
| `multipart/form-data` | Form data with file |

**এই প্রজেক্টে কোথায় ব্যবহার হয়েছে?**

`src/middleware/fileTypeValidator.js` এ:
```javascript
const ALLOWED_MIMETYPES = ["image/jpeg", "image/png", "image/webp"];

// multer যখন file পায়, তখন এই function check করে
if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);   // OK, file accept করো
} else {
    cb(new Error("...")); // reject করো
}
```

**কেন দরকার?**
- শুধু extension check করলে কেউ `virus.exe` কে `photo.jpg` rename করে পাঠাতে পারে
- MIME Type file এর actual content দেখে বলে এটা কী — তাই দুটোই check করা হয়
- এটা একটা **security layer**

---

### Blob (Binary Large Object)

**Blob কী?**
Blob মানে হলো একটা raw binary data এর chunk। যখন তুমি একটা image, video, বা যেকোনো file নিয়ে কাজ করো, সেটা memory তে একটা Blob হিসেবে থাকে।

**সহজ ভাষায়:** তুমি যখন একটা ছবি upload করো, browser সেটাকে 0 আর 1 (binary) এ convert করে — এই binary data এর পুরো block টাই হলো Blob।

**Blob এর বৈশিষ্ট্য:**
- এটা immutable (পরিবর্তন করা যায় না)
- এর একটা `size` আছে (bytes এ)
- এর একটা `type` আছে (MIME Type)

```javascript
// Browser এ Blob তৈরি করা
const blob = new Blob(["Hello World"], { type: "text/plain" });
console.log(blob.size); // 11
console.log(blob.type); // "text/plain"

// File আসলে Blob এর একটা special version
// File extends Blob — মানে প্রতিটা File ই একটা Blob, কিন্তু extra info সহ (name, lastModified)
```

**এই প্রজেক্টে:**
- User যখন file select করে, browser সেটাকে `File` object (Blob এর subclass) হিসেবে handle করে
- `spacesUploader.js` এ file কে `Buffer` হিসেবে read করা হয় (Node.js এর Blob equivalent):
```javascript
const fileContent = await fs.readFile(filePath); // এটা Buffer — binary data
```
- এই Buffer/Blob S3 তে upload হয় as `Body`

---

### FormData

**FormData কী?**
FormData হলো browser এর একটা built-in API যেটা form data কে এমনভাবে package করে যাতে file upload করা যায়। এটা `multipart/form-data` format এ data encode করে।

**সহজ ভাষায়:** তুমি যখন একটা চিঠি পাঠাও, খামের উপরে নাম-ঠিকানা লেখো আর ভেতরে চিঠি রাখো — FormData ঠিক তাই করে। এটা file + তার info কে একটা "খামে" ভরে server এ পাঠায়।

```javascript
// Browser side - FormData তৈরি করা
const formData = new FormData();
formData.append("file", selectedFile);      // file attach করো
formData.append("name", "Hira");            // extra data ও পাঠাতে পারো

// fetch দিয়ে পাঠানো
fetch("/upload/single", {
    method: "POST",
    body: formData    // Content-Type automatically set হয়ে যায়!
});
```

**FormData যখন পাঠানো হয়, HTTP request এ যা যায়:**
```
POST /upload/single HTTP/1.1
Content-Type: multipart/form-data; boundary=----WebKitFormBoundaryABC123

------WebKitFormBoundaryABC123
Content-Disposition: form-data; name="file"; filename="photo.png"
Content-Type: image/png

<binary data of the image - 0s and 1s>
------WebKitFormBoundaryABC123--
```

**Boundary কী?**
- Boundary হলো একটা unique separator string
- এটা বলে দেয় কোথায় একটা part শেষ হয়েছে আর কোথায় আরেকটা শুরু হয়েছে
- ঠিক যেমন বইয়ে page number থাকে chapter আলাদা করতে

**এই প্রজেক্টে:**
- `public/simulation.html` এ FormData এর real visualization আছে
- `src/routes/upload.js` এ Multer এই FormData parse করে

---

### Multer - বিস্তারিত ব্যাখ্যা

**Multer কী?**
Multer হলো একটা Node.js middleware যেটা `multipart/form-data` handle করে — মানে file upload এর কাজ করে। Express নিজে file upload handle করতে পারে না, তাই Multer দরকার হয়।

**সহজ ভাষায়:** Express হলো post office, কিন্তু post office শুধু চিঠি (text/JSON) handle করতে পারে। যখন কেউ parcel (file) পাঠায়, তখন একজন special worker দরকার যে parcel খুলে জিনিস বের করবে — সেটাই Multer।

#### Multer কিভাবে কাজ করে (Step by Step):

```
HTTP Request আসলো (multipart/form-data)
        ↓
Multer Content-Type header পড়ে
        ↓
Boundary string খুঁজে বের করে
        ↓
Body কে boundary দিয়ে আলাদা আলাদা part এ ভাগ করে
        ↓
প্রতিটা part থেকে extract করে:
  - fieldname ("file")
  - originalname ("photo.png")
  - mimetype ("image/png")
  - size (bytes)
  - buffer/stream (actual file data)
        ↓
fileFilter function call করে (validation)
        ↓
Storage engine অনুযায়ী file save করে
        ↓
req.file (single) বা req.files (multiple) এ file info রাখে
        ↓
next() call করে — পরের middleware/handler এ যায়
```

#### Multer Configuration (এই প্রজেক্টে):

```javascript
// src/routes/upload.js

const storage = multer.diskStorage({
    // কোথায় save হবে?
    destination: function (req, file, cb) {
        cb(null, "public/uploads");  // এই folder এ
    },
    // কী নামে save হবে?
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
        // উদাহরণ: 1771181619800-hira.png
        // Date.now() যোগ করা হয় যাতে নাম unique হয়
    }
});

const upload = multer({
    storage: storage,              // উপরের storage config
    limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB
    fileFilter: fileTypeValidator   // MIME type check
});
```

#### Multer এর Storage Options:

| Storage | বর্ণনা | ব্যবহার |
|---------|--------|---------|
| `diskStorage` | File disk এ save করে | এই প্রজেক্টে ব্যবহৃত |
| `memoryStorage` | File memory (RAM) তে Buffer হিসেবে রাখে | ছোট file, direct processing |

#### Multer এর Methods:

```javascript
upload.single("file")      // একটা file, field name "file"
upload.array("files", 5)   // ৫টা পর্যন্ত file, field name "files"
upload.fields([...])       // বিভিন্ন field থেকে file
upload.none()              // কোনো file নেই, শুধু text fields
```

#### req.file Object (Multer যা দেয়):

```javascript
req.file = {
    fieldname: "file",                    // form field এর নাম
    originalname: "hira.png",             // আসল file এর নাম
    encoding: "7bit",                     // encoding type
    mimetype: "image/png",               // MIME Type
    destination: "public/uploads",        // save location
    filename: "1771181619800-hira.png",   // নতুন নাম (unique)
    path: "public/uploads/1771181619800-hira.png", // full path
    size: 106610                          // size in bytes
}
```

#### Multer Error Handling:

```javascript
// src/routes/upload.js
const handleMulterError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        // Multer specific errors
        // যেমন: file too large, too many files
        return res.status(400).json({ error: err.message });
    } else if (err) {
        // অন্য errors (যেমন: invalid file type)
        return res.status(400).json({ error: "Invalid file upload request" });
    }
    next();
};
```

**MulterError এর প্রকারভেদ:**

| Error Code | মানে |
|-----------|------|
| `LIMIT_FILE_SIZE` | File 5MB এর বেশি |
| `LIMIT_FILE_COUNT` | Max file count exceed করেছে |
| `LIMIT_UNEXPECTED_FILE` | ভুল field name ব্যবহার করেছে |

---

### Rate Limiting

**Rate Limiting কী?**
Rate Limiting মানে হলো কতবার একটা কাজ করা যাবে সেটা সীমিত করে দেওয়া। যেমন: "১ মিনিটে সর্বোচ্চ ২টা file upload করতে পারবে।"

**কেন দরকার?**
- কেউ যাতে server কে attack (DDoS) না করতে পারে
- Server এর resource যাতে একজন ব্যবহারকারী একা শেষ না করে দেয়
- Spam upload রোধ করতে

#### এই প্রজেক্টে দুই স্তরের protection আছে:

**১. General Rate Limit (express-rate-limit):**
```javascript
// src/middleware/rate-limit.js
const uploadRateLimit = rateLimit({
    windowMs: 60 * 1000,  // ১ মিনিটের window
    max: 2,               // সর্বোচ্চ ২টা request
    message: { error: "Too many uploads. Max 2 per minute." }
});
// প্রতিটা IP address আলাদাভাবে track হয়
// তোমার IP তে ২ বার upload করলে, আমার IP তে ও ২ বার করতে পারবে
```

**২. Duplicate File Prevention (Custom Middleware):**
```javascript
// একই IP থেকে একই নামের file ৬০ সেকেন্ডের মধ্যে আবার upload করা যাবে না
const recentUploads = new Map(); // Map = key-value store

// Key: "192.168.1.1:photo.png" → Value: timestamp
// ৬০ সেকেন্ড পরে automatically expire হয়ে যায়
```

**কিভাবে কাজ করে:**
```
Request আসলো (IP: 192.168.1.1, File: photo.png)
        ↓
Map এ check করো: "192.168.1.1:photo.png" আছে কিনা?
        ↓
    না থাকলে → Map এ add করো, next() call করো
    থাকলে → 429 status দাও "already uploaded recently"
        ↓
৬০ সেকেন্ড পরে Map থেকে মুছে যায়
```

---

### S3 (Simple Storage Service) & DigitalOcean Spaces

**S3 কী?**
S3 হলো cloud এ file রাখার service। Amazon এটা প্রথম বানিয়েছিল (AWS S3), কিন্তু এখন অনেকে S3-compatible storage দেয় — যেমন DigitalOcean Spaces।

**সহজ ভাষায়:** S3 হলো internet এর মধ্যে একটা unlimited আলমারি যেখানে তুমি যেকোনো file রাখতে পারো আর যেকোনো জায়গা থেকে access করতে পারো।

**Key Concepts:**
- **Bucket:** একটা container/folder যেখানে files রাখা হয় (এখানে: `testbuckets`)
- **Object/Key:** প্রতিটা file এর unique নাম (path)
- **ACL:** Access Control — কে file দেখতে পারবে (`public-read` মানে সবাই দেখতে পারবে)
- **Endpoint:** S3 server এর URL (`https://sgp1.digitaloceanspaces.com`)

```javascript
// src/services/spacesUploader.js
const command = new PutObjectCommand({
    Bucket: spacesConfig.bucket,       // "testbuckets"
    Key: filename,                      // "1771181619800-hira.png"
    Body: fileContent,                  // file এর binary data (Buffer)
    ACL: "public-read",                // সবাই দেখতে পারবে
    ContentType: mimetype              // "image/png"
});

// Upload এর পর URL হয়:
// https://testbuckets.sgp1.digitaloceanspaces.com/1771181619800-hira.png
```

---

### Buffer

**Buffer কী?**
Node.js এ Buffer হলো raw binary data hold করার জায়গা। Browser এ Blob যা করে, Node.js এ Buffer তা করে।

```javascript
// file পড়লে Buffer পাওয়া যায়
const fileContent = await fs.readFile(filePath);
// fileContent হলো একটা Buffer: <Buffer 89 50 4e 47 0d 0a 1a 0a ...>
// এই hex values হলো file এর actual binary content
```

**Buffer vs Blob:**
| Feature | Buffer (Node.js) | Blob (Browser) |
|---------|-----------------|----------------|
| Environment | Server side | Client side |
| Mutability | Mutable (পরিবর্তনযোগ্য) | Immutable |
| Use case | File I/O, streams | File API, fetch |

---

### Task Queue (fastq)

**Queue কী?**
Queue হলো একটা line/সারি — First In, First Out (FIFO)। যে আগে আসবে, তার কাজ আগে হবে।

**কেন দরকার?**
- S3 তে upload সময় লাগে
- User কে অপেক্ষা করাতে চাই না
- তাই locally save করে তাড়াতাড়ি response দিই
- Background এ queue ধীরে ধীরে S3 তে upload করে

```javascript
// src/services/uploadQueue.js
const uploadQueue = fastq.promise(worker, 1);
// 1 = concurrency — একবারে একটাই file process হবে

// Worker function - queue এর প্রতিটা task এ এটা run হয়
async function worker(task) {
    // ১. S3 তে upload করো
    const url = await uploadToSpaces(task.filePath, task.filename, task.mimetype);

    // ২. Local file delete করো (আর দরকার নেই)
    await fs.unlink(task.filePath);
}

// এভাবে queue তে task add করা হয়:
enqueue({ filePath, filename, mimetype });
```

**Flow:**
```
File 1 upload → Queue তে ঢুকলো → S3 তে যাচ্ছে (processing)
File 2 upload → Queue তে ঢুকলো → অপেক্ষা করছে (waiting)
File 3 upload → Queue তে ঢুকলো → অপেক্ষা করছে (waiting)

File 1 শেষ → File 2 শুরু → File 2 শেষ → File 3 শুরু → ...
```

---

### Middleware

**Middleware কী?**
Middleware হলো এমন function যেটা request আর response এর মাঝখানে বসে। এটা request কে process করে, check করে, modify করে, তারপর পরের middleware বা handler এর কাছে পাঠায়।

**সহজ ভাষায়:** তুমি যখন office এ ঢুকো, আগে security check হয়, তারপর ID card দেখায়, তারপর register এ sign করো — তারপর ভেতরে যাও। প্রতিটা step হলো একেকটা middleware।

**এই প্রজেক্টের Middleware Chain:**
```
Request আসলো
    ↓
express.json()          → JSON body parse
    ↓
express.urlencoded()    → Form body parse
    ↓
multer.single/array()   → File extract + save
    ↓
handleMulterError()     → Error থাকলে ধরো
    ↓
uploadRateLimit()       → ২ বারের বেশি হলে block
    ↓
duplicateFileLimit()    → Duplicate হলে block
    ↓
Route Handler           → Response পাঠাও
```

প্রতিটা middleware এর signature:
```javascript
function middleware(req, res, next) {
    // কাজ করো...
    // সব ঠিক থাকলে:
    next();       // পরের middleware এ যাও
    // সমস্যা থাকলে:
    res.status(400).json({ error: "..." }); // এখানেই থামাও
}
```

---

### multipart/form-data

**এটা কী?**
এটা একটা encoding type যেটা HTTP request এ file পাঠানোর জন্য ব্যবহার হয়। সাধারণ form data (`application/x-www-form-urlencoded`) file handle করতে পারে না, তাই `multipart/form-data` দরকার হয়।

**"Multipart" মানে কী?**
Multi + Part = অনেকগুলো অংশ। একটা request এ অনেকগুলো আলাদা আলাদা data part থাকে — text field, file, আরেকটা file — সবাই boundary দিয়ে আলাদা।

```
------WebKitFormBoundaryABC123          ← Part 1 শুরু
Content-Disposition: form-data; name="username"

Hira                                     ← text data
------WebKitFormBoundaryABC123          ← Part 2 শুরু
Content-Disposition: form-data; name="file"; filename="photo.png"
Content-Type: image/png

<PNG file binary data>                   ← file data
------WebKitFormBoundaryABC123--        ← শেষ (-- দিয়ে বোঝায়)
```

---

### dotenv ও .env

**.env কী?**
`.env` হলো একটা file যেখানে secret/sensitive information রাখা হয় — যেমন API keys, passwords, database URLs।

**কেন আলাদা file এ রাখি?**
- Code এ directly secret লিখলে GitHub এ push করলে সবাই দেখে ফেলবে
- `.gitignore` এ `.env` add করা থাকে তাই Git এ যায় না
- বিভিন্ন environment এ (development, production) আলাদা values ব্যবহার করা যায়

```bash
# .env file
DO_SPACES_KEY=your_access_key_here
DO_SPACES_SECRET=your_secret_key_here
DO_SPACES_ENDPOINT=https://sgp1.digitaloceanspaces.com
DO_SPACES_BUCKET=your_bucket_name
DO_SPACES_REGION=sgp1
```

```javascript
// index.js এ dotenv load করা হয়
require("dotenv").config();

// এরপর যেকোনো জায়গায়:
process.env.DO_SPACES_KEY  // → তোমার actual key value আসবে
```

---

## API Endpoints

### `GET /`
Home route — welcome message।

### `POST /upload/single`
একটা file upload করো।

| Parameter | Type | বর্ণনা |
|-----------|------|--------|
| `file` | File (form-data) | Upload করার file |

**Response (200):**
```json
{
    "message": "File uploaded successfully",
    "file": {
        "filename": "1771181619800-hira.png",
        "originalname": "hira.png",
        "size": 106610,
        "mimetype": "image/png",
        "url": "/uploads/1771181619800-hira.png"
    }
}
```

### `POST /upload/multiple`
একসাথে ৫টা পর্যন্ত file upload করো।

| Parameter | Type | বর্ণনা |
|-----------|------|--------|
| `files` | File[] (form-data) | Upload করার files (max 5) |

**Response (200):**
```json
{
    "message": "3 file(s) uploaded successfully",
    "files": [...]
}
```

### Error Responses

| Status | কারণ |
|--------|------|
| `400` | Invalid file type, file too large, no file sent |
| `429` | Rate limit exceeded (2/min) বা duplicate file |

---

## Dependencies

| Package | Version | কাজ |
|---------|---------|-----|
| `express` | ^5.2.1 | Web framework — routing, middleware |
| `multer` | ^2.0.2 | File upload parsing (multipart/form-data) |
| `@aws-sdk/client-s3` | ^3.990.0 | S3-compatible cloud storage SDK |
| `express-rate-limit` | ^8.2.1 | Rate limiting middleware |
| `fastq` | ^1.20.1 | Fast async task queue |
| `dotenv` | ^17.3.1 | .env file loader |

---

## Security Features

| Feature | কিভাবে কাজ করে |
|---------|----------------|
| File type validation | Extension + MIME Type দুটোই check |
| File size limit | সর্বোচ্চ 5MB |
| Rate limiting | প্রতি IP তে ১ মিনিটে ২টা upload |
| Duplicate prevention | একই file ৬০ সেকেন্ডে আবার upload করা যায় না |
| Environment variables | Secret keys `.env` file এ, code এ না |

---

## শেখার Resource

- `public/simulation.html` ওপেন করো browser এ — upload process এর interactive visualization দেখতে পাবে
- প্রতিটা step animate হয়ে দেখায় কিভাবে file browser থেকে server এ যায়

---

## কিভাবে Run করবে

```bash
# Dependencies install
npm install

# .env file তৈরি করো (উপরের format অনুযায়ী)

# Server start
node index.js
# Server চলবে: http://localhost:3000

# Simulation দেখো:
# http://localhost:3000/simulation.html
```
