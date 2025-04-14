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

  // Epub metadata extraction
  extractMetaData: (filePath) => ipcRenderer.invoke('extract-metadata', filePath),

  // Get book cover image object
  getBookCover: (id) => ipcRenderer.invoke('get-book-cover', id),

  // Copy a file in to the library by drag n drop
  handleEpubDrag: (fileData) => ipcRenderer.invoke('handle-epub-drag', fileData),

  readEpub: (filePath) => ipcRenderer.invoke('handle-read-epub', filePath),



});

contextBridge.exposeInMainWorld('readerAPI', {
  getBookPath: () => {
    const urlParams = new URLSearchParams(location.search);
    return urlParams.get('path');
  },
  getBookBuffer: (filePath) => ipcRenderer.invoke('get-epub-buffer', filePath),

  openReaderWindow: (filePath) => ipcRenderer.invoke('open-reader-window', filePath),
});



console.log('databaseAPI has been exposed.');