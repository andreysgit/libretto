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

// Book-related operations
ipcMain.handle('add-book', (event, bookData) => {
  try {

    //book data
    /*title,
    author,
    description,
    filePath
    coverPath
    */

    console.log(bookData.filePath)
    const libraryBase = path.join(__dirname, 'library');

    // Construct the directory path: library/author/title
    const targetDir = path.join(libraryBase, bookData.author, bookData.title);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // Create the file name: title - author.epub
    const fileName = `${bookData.title} - ${bookData.author}.epub`;
    const destPath = path.join(targetDir, fileName);
    console.log(`Dest path: ${destPath}`)

    // Copy the file if it doesn't already exist in the library
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(bookData.filePath, destPath);
    }


    const stmt = db.prepare(`
      INSERT INTO books (title, author, file_path, cover_path, description)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      bookData.title,
      bookData.author,
      bookData.filePath,
      bookData.coverPath || null,
      bookData.description || null
    );

    
    
    return result.lastInsertRowid;
  } catch (err) {
    console.error('Error adding book:', err);
    throw err;
  }
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


ipcMain.handle('extract-metadata', async (event, filePath) => {

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
    
    console.log("Extracted metadata");
    return metadata;

  } catch (err) {
    console.error("Failed to extract metadata", err);
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
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Image Files', extensions: ['jpg', 'jpeg', 'png', 'gif'] }]
  });
  
  if (canceled || filePaths.length === 0) {
    return null;
  }
  
  // Copy the image to a covers folder
  const coversPath = path.join(__dirname, 'covers');
  if (!fs.existsSync(coversPath)) {
    fs.mkdirSync(coversPath, { recursive: true });
  }
  
  const fileName = path.basename(filePaths[0]);
  const destPath = path.join(coversPath, fileName);
  
  // Copy file if it doesn't already exist
  if (!fs.existsSync(destPath)) {
    fs.copyFileSync(filePaths[0], destPath);
  }
  
  return destPath;
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