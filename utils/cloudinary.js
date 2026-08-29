const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function assertCloudinaryConfigured() {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error(
      'Cloudinary is not configured on the server (missing CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET)'
    );
  }
}

function sanitizePublicId(filename = '') {
  const base = String(filename)
    .split('/')
    .pop()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80);
  return base || `file_${Date.now()}`;
}

function uploadBufferToCloudinary(fileBuffer, folder, filename, mimetype, timeoutMs = 30000) {
  assertCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    if (!fileBuffer || !fileBuffer.length) {
      return reject(new Error('Empty file buffer'));
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Cloudinary upload timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const finish = (fn) => (arg) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(arg);
    };

    console.log('[cloudinary] upload start', {
      folder,
      filename,
      bytes: fileBuffer.length,
      mimetype,
    });

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: `${sanitizePublicId(filename)}_${Date.now()}`,
        resource_type: 'image',
        timeout: timeoutMs,
      },
      (error, result) => {
        if (error) {
          console.error('[cloudinary] upload failed', error.message || error);
          return finish(reject)(error);
        }
        console.log('[cloudinary] upload ok', result.public_id);
        finish(resolve)(result.secure_url);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
}

module.exports = { uploadBufferToCloudinary };
