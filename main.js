const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
require('dotenv').config(); //Manage environment variables
const db = require('./my_sqlite3.js');  // Initialize database
const { EPub } = require('epub2'); // Epub metadata extraction library
const coverPath = path.join(__dirname, 'images', 'cover_placeholder.png');
const coverURL = `file://${coverPath}`;
const libraryPath = path.join(__dirname, 'library');
const os = require('os');


console.log(libraryPath)


//Creates the main window of the application
function createWindow () {
  const win = new BrowserWindow({
    width: parseInt(process.env.WINDOW_WIDTH) || 800,
    height: parseInt(process.env.WINDOW_HEIGHT) || 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile('index.html');
  
  // Only open DevTools if enabled in environment
  if (process.env.DEV_TOOLS === 'true') {
    win.webContents.openDevTools();
  }
}

// Handle database operations in the main process
ipcMain.handle('insert-user', (event, name) => {
  try {
    const stmt = db.prepare('INSERT INTO users (name) VALUES (?)');
    const result = stmt.run(name);
    return result.lastInsertRowid;
  } catch (err) {
    console.error('Error inserting user:', err);
    throw err;
  }
});

ipcMain.handle('get-cover-placeholder', () => {
  try {

    return `${coverURL}`

  } catch (err) {
    console.error('Error getting cover placeholder:', err);
  }
});

ipcMain.handle('get-users', () => {
  try {
    const stmt = db.prepare('SELECT * FROM users');
    return stmt.all();
  } catch (err) {
    console.error('Error getting users:', err);
    throw err;
  }
});

async function addBook(bookData){
  try {
    // bookData should include:
    // title, author, description, filePath, coverPath, coverImage

    console.log(`Adding book: ${bookData.title} by ${bookData.author}`)

    const libraryBase = path.join(__dirname, 'library');

    // Construct the directory path: library/author/title
    const targetDir = path.join(libraryBase, bookData.author, bookData.title);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Create the file name: title - author.epub
    const fileName = `${bookData.title} - ${bookData.author}.epub`;
    const destPath = path.join(targetDir, fileName);
    console.log(`Dest path: ${destPath}`);

    // Copy the file if it doesn't already exist in the library
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(bookData.filePath, destPath);
    }

    // Process cover file if provided; otherwise, use a default cover image from assets
    let finalCoverPath = null;

    let dataUrl;

    if (bookData.cover) {
      let matches = null;
      // Expecting coverImage to be a data URL like "data:image/png;base64,..."
      // If coverImage is an object, convert it to a data URL string.
        if (typeof bookData.cover === 'object' && bookData.cover.data && bookData.cover.mimeType) {
          dataUrl = `data:${bookData.cover.mimeType};base64,${bookData.cover.data}`;
        } else if (typeof bookData.cover === 'string') {
          dataUrl = bookData.cover;
        }

        if(dataUrl){
          matches = dataUrl.match(/^data:(.+);base64,(.+)$/);

        }

        
      if (matches) {
        const mimeType = matches[1]; // e.g., image/png
        const base64Data = matches[2];
        const coverBuffer = Buffer.from(base64Data, 'base64');
        // Determine file extension from mime type
        const extension = mimeType.split('/')[1] || 'png';
        const coverFileName = `${bookData.title} - ${bookData.author}.${extension}`;
        finalCoverPath = path.join(targetDir, coverFileName);
        // Write the cover image file
        fs.writeFileSync(finalCoverPath, coverBuffer);
      } else {
        console.error('Invalid cover image data URL');
      }
    } else if (bookData.coverPath) {
      // User provided a cover path - saves that file to the library
      const coverFileExt = path.extname(bookData.coverPath);
      const coverFileName = `${bookData.title} - ${bookData.author}${coverFileExt}`;
      finalCoverPath = path.join(targetDir, coverFileName);
      if (!fs.existsSync(finalCoverPath)) {
        fs.copyFileSync(bookData.coverPath, finalCoverPath);
      }

    } else {
      // Use a default cover if no cover provided
      const defaultCoverSource = path.join(__dirname, 'assets', 'default_cover.png');
      const coverFileName = `${bookData.title} - ${bookData.author}.png`;
      finalCoverPath = path.join(targetDir, coverFileName);
      if (fs.existsSync(defaultCoverSource) && !fs.existsSync(finalCoverPath)) {
        fs.copyFileSync(defaultCoverSource, finalCoverPath);
      }
    } // End of cover file processing

    console.log(`Final cover file path: ${finalCoverPath}`);

    const stmt = db.prepare(`
      INSERT INTO books (title, author, file_path, cover_path, description)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      bookData.title,
      bookData.author,
      destPath,
      finalCoverPath || null,
      bookData.description || null
    );
    
    return result.lastInsertRowid;
  } catch (err) {
    console.error('Error adding book:', err);
    throw err;
  }
}

// Book-related operations
ipcMain.handle('add-book', (event, bookData) => {
  result = addBook(bookData);
  return result;

});

ipcMain.handle('get-books', () => {
  try {
    const stmt = db.prepare('SELECT * FROM books ORDER BY added_date DESC');
    return stmt.all();
  } catch (err) {
    console.error('Error getting books:', err);
    throw err;
  }
});


async function extractMetaData(filePath){

  try {
    console.log("Creating EPUB instance for:", filePath);

    const epub = await EPub.createAsync(filePath, '/images/', '/chapters/');

    const metadata = {
      title: epub.metadata?.title || null,
      author: epub.metadata?.creator || null,
      language: epub.metadata?.language || null,
      subject: epub.metadata?.subject || null,
      description: epub.metadata?.description || null,
      date: epub.metadata?.date || null,
      raw: epub.metadata[EPub.SYMBOL_RAW_DATA] || null,
    };

    // Extract cover image if available
    if (epub.metadata.cover) {
      metadata.cover = await new Promise((resolve, reject) => {
        epub.getImage(epub.metadata.cover, (err, data, mimeType) => {
          if (err) {
            console.error("Error extracting cover image:", err);
            return reject(err);
          }
          // Convert the Buffer to a base64 string for IPC transfer.
          resolve({
            data: data.toString('base64'),
            mimeType: mimeType,
          });
        });
      });
    } else {
      metadata.cover = null;
    }
    
    return metadata;
  } catch (err) {
    console.error("Failed to extract metadata", err);
    throw err;
  }

}

ipcMain.handle('extract-metadata', async (event, filePath) => {

    const metaData = extractMetaData(filePath);
    console.log("Extracted metadata");
    return metaData;

});

ipcMain.handle('get-book-cover', async (event, bookId) => {
  try {
    // Query the database for the cover_path of the book
    const stmt = db.prepare('SELECT cover_path FROM books WHERE id = ?');
    const row = stmt.get(bookId);

    if (!row || !row.cover_path) {
      // No cover image exists for this book
      return null;
    }

    const coverPath = row.cover_path;
    // Check if the cover file actually exists
    if (!fs.existsSync(coverPath)) {
      return null;
    }

    // Read the cover file as a Buffer
    const coverBuffer = fs.readFileSync(coverPath);

    // Determine the MIME type from the file extension
    const ext = path.extname(coverPath).toLowerCase();
    let mimeType = 'image/png'; // default MIME type
    if (ext === '.jpg' || ext === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === '.gif') {
      mimeType = 'image/gif';
    }

    // Convert the Buffer to a Base64 string and construct the data URL
    const base64Data = coverBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Data}`;
    return dataUrl;
  } catch (err) {
    console.error('Error in get-book-cover:', err);
    throw err;
  }
});


ipcMain.handle('get-book-by-id', (event, id) => {
  try {
    const stmt = db.prepare('SELECT * FROM books WHERE id = ?');
    return stmt.get(id);
  } catch (err) {
    console.error('Error getting book:', err);
    throw err;
  }
});



ipcMain.handle('update-book', (event, id, bookData) => {
  try {
    const stmt = db.prepare(`
      UPDATE books 
      SET title = ?, author = ?, description = ?, cover_path = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(
      bookData.title,
      bookData.author,
      bookData.description || null,
      bookData.coverPath || null,
      id
    );
    
    return result.changes > 0;
  } catch (err) {
    console.error('Error updating book:', err);
    throw err;
  }
});


ipcMain.handle('handle-epub-drag', async (event, fileData) => {
  if (fileData.path) {
    result = extractMetaData(fileData.path)
    return { status: 'success', type: 'path' };
    //Epub extractor library requires a filepath
    //If we have data instead, we should save that data as a temporary file and use it to extract metadata before saving the file to the library

  } else if (fileData.data) {
    const arrayBuffer = fileData.data;
    console.log("EPUB loaded in browser. Length:", arrayBuffer.byteLength);
    
    // Generate a temporary file path.
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, `temp-${Date.now()}.epub`);
    
    // Write the ArrayBuffer to the temporary file.
    fs.writeFileSync(tempFilePath, Buffer.from(arrayBuffer));
    
    // Now extract the metadata using the temporary file path.


    let bookData;
    try {
      bookData = await extractMetaData(tempFilePath);
      if (!bookData) {
        throw new Error("Metadata extraction returned undefined");
      }
    } catch (error) {
      console.error("Error extracting metadata:", error);
      return { status: 'error', message: 'Metadata extraction failed' };
    }
    
    bookData.filePath = tempFilePath;
    // console.log("bookdata = " + JSON.stringify(bookData, null, 2));
    const bookId = await addBook(bookData);
    
    // Optionally, delete the temporary file if it's no longer needed:
    fs.unlinkSync(tempFilePath);
    
    return { status: 'success', type: 'data', metadata: bookData, bookId };
  } else {
    return { status: 'error', message: 'Invalid file data' };
  }
});


ipcMain.handle('delete-book', (event, id) => {
  try {
    const stmt = db.prepare('DELETE FROM books WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  } catch (err) {
    console.error('Error deleting book:', err);
    throw err;
  }
});

// Tag-related operations
ipcMain.handle('add-tag', (event, name) => {
  try {
    const stmt = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
    const result = stmt.run(name);
    
    if (result.changes === 0) {
      // Tag already exists, get its ID
      const getStmt = db.prepare('SELECT id FROM tags WHERE name = ?');
      return getStmt.get(name).id;
    }
    
    return result.lastInsertRowid;
  } catch (err) {
    console.error('Error adding tag:', err);
    throw err;
  }
});



ipcMain.handle('get-tags', () => {
  try {
    const stmt = db.prepare('SELECT * FROM tags ORDER BY name');
    return stmt.all();
  } catch (err) {
    console.error('Error getting tags:', err);
    throw err;
  }
});

ipcMain.handle('add-tag-to-book', (event, bookId, tagId) => {
  try {
    const stmt = db.prepare('INSERT OR IGNORE INTO book_tags (book_id, tag_id) VALUES (?, ?)');
    const result = stmt.run(bookId, tagId);
    return result.changes > 0;
  } catch (err) {
    console.error('Error adding tag to book:', err);
    throw err;
  }
});

ipcMain.handle('get-book-tags', (event, bookId) => {
  try {
    const stmt = db.prepare(`
      SELECT t.* FROM tags t
      JOIN book_tags bt ON t.id = bt.tag_id
      WHERE bt.book_id = ?
      ORDER BY t.name
    `);
    return stmt.all(bookId);
  } catch (err) {
    console.error('Error getting book tags:', err);
    throw err;
  }
});

// File selection operations
ipcMain.handle('select-epub-file', async () => {
  //return the selected epub's path
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'EPUB Files', extensions: ['epub'] }]
  });
  
  if (canceled || filePaths.length === 0) {
    return null;
  }

  const sourcePath = filePaths[0];
  
  return {sourcePath};
});


ipcMain.handle('select-cover-image', async () => {
  //returns the selected image's path
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif'] }]
  });
  
  if (canceled || filePaths.length === 0) {
    return null;
  }
  
  return filePaths[0];
});


app.whenReady().then(createWindow);

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on('window-all-closed', () => {
  //This checks if the platform is NOT macOS 'darwin' is the identifier for macOS in Node.js
  if (process.platform !== 'darwin') {
    db.close();
    app.quit();
  }
});