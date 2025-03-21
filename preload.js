const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('databaseAPI', {
  //Book cover operations
  getCoverPlaceholder: () => ipcRenderer.invoke('get-cover-placeholder'),

  // User-related operations
  insertUser: (name) => ipcRenderer.invoke('insert-user', name),
  getUsers: () => ipcRenderer.invoke('get-users'),
  
  // Book-related operations
  addBook: (bookData) => ipcRenderer.invoke('add-book', bookData),
  getBooks: () => ipcRenderer.invoke('get-books'),
  getBookById: (id) => ipcRenderer.invoke('get-book-by-id', id),
  deleteBook: (id) => ipcRenderer.invoke('delete-book', id),
  updateBook: (id, bookData) => ipcRenderer.invoke('update-book', id, bookData),
  
  // Tag-related operations
  addTag: (name) => ipcRenderer.invoke('add-tag', name),
  getTags: () => ipcRenderer.invoke('get-tags'),
  addTagToBook: (bookId, tagId) => ipcRenderer.invoke('add-tag-to-book', bookId, tagId),
  getBookTags: (bookId) => ipcRenderer.invoke('get-book-tags', bookId),
  
  // File operations
  selectEpubFile: () => ipcRenderer.invoke('select-epub-file'),
  selectCoverImage: () => ipcRenderer.invoke('select-cover-image'),

  // Web server operations
  startWebServer: () => ipcRenderer.invoke('start-web-server'),
  stopWebServer: () => ipcRenderer.invoke('stop-web-server'),

  // Epub metadata extraction
  extractMetaData: (filePath) => ipcRenderer.invoke('extract-metadata', filePath)
  
});

console.log('databaseAPI has been exposed.');