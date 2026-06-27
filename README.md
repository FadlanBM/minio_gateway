# MinIO Express Bridge API

API ini bertindak sebagai jembatan (bridge) aman antara MinIO Object Storage dan aplikasi frontend Flutter. Ia mendukung unggah file proxy, pembuatan Presigned URL (PUT/GET), daftar file, dan penghapusan file.

---

## 🚀 Fitur Utama

- **Proxy Upload (`POST /api/files/upload`)**: Mengunggah file dari Flutter ke Express, lalu diteruskan ke MinIO.
- **Presigned Upload URL (`GET /api/files/presigned-upload-url`)**: Membuat secure URL bagi Flutter untuk mengunggah file langsung ke MinIO (efisien untuk file besar).
- **Presigned Download URL (`GET /api/files/presigned-download-url`)**: Membuat secure URL sementara untuk menampilkan/mengunduh file dari bucket private.
- **List Files (`GET /api/files/list`)**: Menampilkan daftar file dalam bucket berdasarkan folder/prefix.
- **Delete Object (`DELETE /api/files/delete`)**: Menghapus file dari bucket.

---

## 🛠️ Instalasi & Konfigurasi

### 1. Prasyarat
Pastikan sudah menginstal:
- [Node.js](https://nodejs.org/) (versi >= 18)
- [MinIO Server](https://min.io/) yang sedang berjalan

### 2. Pemasangan Dependency
Jalankan perintah berikut di direktori ini:
```bash
npm install
```

### 3. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env` lalu sesuaikan isinya:
```env
PORT=5000
NODE_ENV=development

# MinIO Credentials
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_DEFAULT_BUCKET=promilku
```

### 4. Menjalankan Server
**Mode Pengembangan (dengan Nodemon auto-restart):**
```bash
npm run dev
```

**Mode Produksi:**
```bash
npm start
```

---

## 🌐 Dokumentasi API

### 1. Health Check
- **URL:** `GET /health`
- **Response:**
  ```json
  {
    "status": "OK",
    "timestamp": "2026-06-28T00:00:00.000Z"
  }
  ```

### 2. Proxy Upload (Multipart POST)
- **URL:** `POST /api/files/upload`
- **Headers:** `Content-Type: multipart/form-data`
- **Body Form-Data:**
  - `file`: File binary (misal: gambar/dokumen)
  - `path`: (Opsional) Folder dalam bucket, contoh: `users/avatars`
  - `bucket`: (Opsional) Nama bucket tujuan lain jika bukan default
- **Response:**
  ```json
  {
    "message": "File uploaded successfully",
    "bucket": "promilku",
    "objectName": "users/avatars/1719530000-123456789.png",
    "originalName": "avatar.png",
    "size": 14205,
    "mimeType": "image/png",
    "url": "http://localhost:9000/promilku/users/avatars/1719530000-123456789.png?AWSAccessKeyId=..."
  }
  ```

### 3. Dapatkan Presigned Upload URL (PUT)
- **URL:** `GET /api/files/presigned-upload-url`
- **Query Parameters:**
  - `filename`: `photo.jpg` (Wajib)
  - `contentType`: `image/jpeg` (Direkomendasikan)
  - `path`: `receipts` (Opsional, folder tujuan)
  - `expiry`: `900` (Opsional, kedaluwarsa dalam detik. Default 15 menit)
- **Response:**
  ```json
  {
    "uploadUrl": "http://localhost:9000/promilku/receipts/1719530000-123456789.jpg?X-Amz-Algorithm=...",
    "objectName": "receipts/1719530000-123456789.jpg",
    "bucket": "promilku",
    "expirySeconds": 900,
    "headers": {
      "Content-Type": "image/jpeg"
    }
  }
  ```

### 4. Dapatkan Presigned Download URL (GET)
- **URL:** `GET /api/files/presigned-download-url`
- **Query Parameters:**
  - `objectName`: `receipts/1719530000-123456789.jpg` (Wajib)
  - `expiry`: `86400` (Opsional, kedaluwarsa dalam detik. Default 24 jam)
- **Response:**
  ```json
  {
    "downloadUrl": "http://localhost:9000/promilku/receipts/1719530000-123456789.jpg?AWSAccessKeyId=...",
    "objectName": "receipts/1719530000-123456789.jpg",
    "bucket": "promilku",
    "expirySeconds": 86400
  }
  ```

### 5. List Files
- **URL:** `GET /api/files/list`
- **Query Parameters:**
  - `prefix`: `receipts/` (Opsional, memfilter folder tertentu)
  - `recursive`: `true` (Opsional, default `false`)
- **Response:**
  ```json
  {
    "bucket": "promilku",
    "prefix": "receipts/",
    "recursive": false,
    "count": 1,
    "objects": [
      {
        "name": "receipts/1719530000-123456789.jpg",
        "lastModified": "2026-06-28T00:00:00.000Z",
        "etag": "a1b2c3d4...",
        "size": 14205
      }
    ]
  }
  ```

### 6. Delete File
- **URL:** `DELETE /api/files/delete`
- **Query/Body (JSON):**
  - `objectName`: `receipts/1719530000-123456789.jpg` (Wajib)
- **Response:**
  ```json
  {
    "message": "Object deleted successfully",
    "bucket": "promilku",
    "objectName": "receipts/1719530000-123456789.jpg"
  }
  ```

---

## 📱 Contoh Integrasi Flutter (Dart)

Tambahkan package berikut pada `pubspec.yaml` Flutter Anda:
```yaml
dependencies:
  http: ^1.2.0
  file_picker: ^8.0.0 # opsional untuk mengambil file dari storage HP
```

### 1. Unggah via Proxy API (Multipart POST)
Gunakan metode ini jika Anda ingin file diproses terlebih dahulu oleh Express API Anda.

```dart
import 'dart:io';
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<Map<String, dynamic>?> uploadFileProxy(File file, String folderPath) async {
  final uri = Uri.parse('http://<API_IP>:5000/api/files/upload');
  
  var request = http.MultipartRequest('POST', uri);
  
  // Masukkan file
  request.files.add(
    await http.MultipartFile.fromPath(
      'file', 
      file.path,
    ),
  );
  
  // Parameter tambahan
  request.fields['path'] = folderPath; // Misal: 'user_avatars'

  try {
    var streamedResponse = await request.send();
    var response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode == 201) {
      return json.decode(response.body);
    } else {
      print('Gagal upload: ${response.body}');
      return null;
    }
  } catch (e) {
    print('Error: $e');
    return null;
  }
}
```

### 2. Unggah Efisien via Presigned URL (HTTP PUT)
Langkah ini sangat direkomendasikan karena file langsung diunggah dari HP ke MinIO secara aman, menghemat resource server Express.

```dart
import 'dart:io';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:path/path.dart' as p;

Future<String?> uploadWithPresignedUrl(File file, String folderPath) async {
  final fileName = p.basename(file.path);
  final contentType = _getMimeType(fileName); // Tentukan mimeType (contoh: image/png)

  // 1. Minta Presigned PUT URL dari API bridge kita
  final bridgeUri = Uri.parse(
    'http://<API_IP>:5000/api/files/presigned-upload-url'
    '?filename=$fileName'
    '&contentType=$contentType'
    '&path=$folderPath'
  );

  try {
    final responseBridge = await http.get(bridgeUri);
    if (responseBridge.statusCode != 200) {
      print('Gagal mendapatkan Presigned URL: ${responseBridge.body}');
      return null;
    }

    final bridgeData = json.decode(responseBridge.body);
    final String uploadUrl = bridgeData['uploadUrl'];
    final String objectName = bridgeData['objectName'];

    // 2. Upload file menggunakan PUT langsung ke URL MinIO
    final bytes = await file.readAsBytes();
    final uploadResponse = await http.put(
      Uri.parse(uploadUrl),
      headers: {
        'Content-Type': contentType,
      },
      body: bytes,
    );

    if (uploadResponse.statusCode == 200) {
      print('Upload sukses langsung ke MinIO!');
      return objectName; // Kembalikan objectName untuk disimpan di DB Anda
    } else {
      print('Upload gagal: ${uploadResponse.body}');
      return null;
    }
  } catch (e) {
    print('Error: $e');
    return null;
  }
}

String _getMimeType(String fileName) {
  final ext = p.extension(fileName).toLowerCase();
  if (ext == '.jpg' || ext == '.jpeg') return 'image/jpeg';
  if (ext == '.png') return 'image/png';
  if (ext == '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}
```

### 3. Menampilkan Gambar Menggunakan Presigned GET URL
Jika bucket Anda **private** (tidak diakses publik langsung), Anda harus meminta link view sementara dari API.

```dart
import 'package:http/http.dart' as http;
import 'dart:convert';

Future<String?> getDownloadUrl(String objectName) async {
  final uri = Uri.parse(
    'http://<API_IP>:5000/api/files/presigned-download-url'
    '?objectName=$objectName'
    '&expiry=86400' // Berlaku 24 jam
  );

  try {
    final response = await http.get(uri);
    if (response.statusCode == 200) {
      final data = json.decode(response.body);
      return data['downloadUrl']; // URL gambar yang siap ditaruh di Image.network()
    }
  } catch (e) {
    print('Error: $e');
  }
  return null;
}

// Penggunaan di Flutter Widget:
// FutureBuilder<String?>(
//   future: getDownloadUrl('receipts/image.jpg'),
//   builder: (context, snapshot) {
//     if (snapshot.hasData && snapshot.data != null) {
//       return Image.network(snapshot.data!);
//     }
//     return CircularProgressIndicator();
//   }
// )
```
