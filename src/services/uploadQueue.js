const fastq = require("fastq");
const fs = require("fs/promises");
const { uploadToSpaces } = require("./spacesUploader");

async function worker(task) {
  const { filePath, filename, mimetype } = task;

  try {
    const spacesUrl = await uploadToSpaces(filePath, filename, mimetype);
    console.log(`Uploaded to Spaces: ${spacesUrl}`);
  } catch (err) {
    console.error(`Failed to upload ${filename} to Spaces:`, err.message);
    throw err;
  }

  try {
    await fs.unlink(filePath);
    console.log(`Deleted local file: ${filePath}`);
  } catch (err) {
    console.error(`Failed to delete local file ${filePath}:`, err.message);
  }
}

const uploadQueue = fastq.promise(worker, 1);

function enqueue(task) {
  uploadQueue.push(task).catch((err) => {
    console.error(`Queue task failed for ${task.filename}:`, err.message);
  });
}

module.exports = { enqueue };
