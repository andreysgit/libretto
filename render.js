// Global variables
let selectedEpubPath = null;
let selectedCoverPath = null;
let currentBookId = null;
let books = [];

// DOM Elements
const bookDateInput = document.getElementById('bookDate');
const bookTitleInput = document.getElementById('bookTitle');
const bookAuthorInput = document.getElementById('bookAuthor');
const bookDescriptionInput = document.getElementById('bookDescription');
const bookTagsInput = document.getElementById('bookTags');
const selectEpubBtn = document.getElementById('selectEpubBtn');
const selectCoverBtn = document.getElementById('selectCoverBtn');
const selectedEpubFile = document.getElementById('selectedEpubFile');
const selectedCoverFile = document.getElementById('selectedCoverFile');
const selectedCoverImage = document.getElementById('selectedCoverImage');
const addBookBtn = document.getElementById('addBookBtn');
const bookGrid = document.getElementById('bookGrid');
const bookModal = document.getElementById('bookModal');
const closeModal = document.getElementById('closeModal');
const modalBookTitle = document.getElementById('modalBookTitle');
const modalBookAuthor = document.getElementById('modalBookAuthor');
const modalBookDescription = document.getElementById('modalBookDescription');
const modalBookCover = document.getElementById('modalBookCover');
const modalBookTags = document.getElementById('modalBookTags');
const deleteBookBtn = document.getElementById('deleteBookBtn');
const openExternalBtn = document.getElementById('openExternalBtn');
const startServerBtn = document.getElementById('startServerBtn');
const stopServerBtn = document.getElementById('stopServerBtn');
const serverStatus = document.getElementById('serverStatus');
const coverImage = document.getElementById('selectedCoverImage')

// Initialize the application
async function init() {
    await loadBooks();
    setupEventListeners();
    setupTabs();
    
    const coverPlaceHolder = await window.databaseAPI.getCoverPlaceholder();
    const coverImage = document.getElementById('selectedCoverImage');
    coverImage.src = coverPlaceHolder;

}

// Load books from the database
async function loadBooks() {
    try {
        books = await window.databaseAPI.getBooks();
        renderBooks();
    } catch (err) {
        console.error('Error loading books:', err);
    }
}

// Render books in the grid
function renderBooks() {
    bookGrid.innerHTML = '';
    
    if (books.length === 0) {
        bookGrid.innerHTML = '<p>No books in your library yet. Add your first book using the form on the left.</p>';
        return;
    }
    
    books.forEach(book => {
        const bookCard = document.createElement('div');
        bookCard.className = 'book-card';
        bookCard.dataset.id = book.id;
        
        const coverStyle = book.cover_path 
            ? `background-image: url("file://${book.cover_path}")` 
            : 'background-color: #4a6da7';
        
        bookCard.innerHTML = `
            <div class="book-cover" style="${coverStyle}"></div>
            <div class="book-info">
                <h3 class="book-title">${book.title}</h3>
                <p class="book-author">${book.author}</p>
            </div>
        `;
        
        bookCard.addEventListener('click', () => openBookDetails(book.id));
        bookGrid.appendChild(bookCard);
    });
}

async function extractMetaData(epubPath) {
    console.log("🔵 Calling extractMetaData with path:", epubPath);
    if (!epubPath) {
        console.error("❌ extractMetaData received undefined path!");
        return;
    }

    const metaData = await window.databaseAPI.extractMetaData(epubPath);
    console.log("Metadata received:", metaData);
    return metaData; // metaData is a plain JS object
}

// Set up event listeners
function setupEventListeners() {
    console.log("setting up event listeners")
    // Select EPUB file
    selectEpubBtn.addEventListener('click', async () => {
        const fileInfo = await window.databaseAPI.selectEpubFile();
        const { sourcePath, destPath } = fileInfo;
        console.log("📂 Source:", sourcePath);
        console.log("📥 Dest:", destPath);
      

        console.log('Selected EPUB Path:', sourcePath); 
        // Selected EPUB Path: /Users/andrey/Code/libretto/library/pg345-images-3.epub
        if (sourcePath && destPath) {
            selectedEpubFile.textContent = sourcePath.split('/').pop();
            try {
                const metaData = await extractMetaData(sourcePath);
                bookTitleInput.value = metaData.title;
                bookAuthorInput.value = metaData['author'];
                bookDateInput.value = metaData['date'];
                coverImage.src = `data:${metaData.cover.mimeType};base64,${metaData.cover.data}`;

            } catch (err) {
                console.error('Failed to extract metadata:', err);
              }
            // Optional: Display metadata in the UI

            updateAddButtonState();
        }
    });
    
    // Select cover image
    selectCoverBtn.addEventListener('click', async () => {
        selectedCoverPath = await window.databaseAPI.selectCoverImage();
        if (selectedCoverPath) {
            selectedCoverFile.textContent = selectedCoverPath.split('/').pop();
        }
    });
    
    // Add book
    addBookBtn.addEventListener('click', async () => {
        const title = bookTitleInput.value.trim();
        const author = bookAuthorInput.value.trim();
        const description = bookDescriptionInput.value.trim();
        const tags = bookTagsInput.value.trim();
        
        if (!title || !author || !selectedEpubPath) {
            alert('Please fill in all required fields (title, author, and EPUB file)');
            return;
        }
        
        try {
            // Add the book
            const bookId = await window.databaseAPI.addBook({
                title,
                author,
                description,
                filePath: selectedEpubPath,
                coverPath: selectedCoverPath
            });
            
            // Add tags if provided
            if (tags) {
                const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag);
                for (const tagName of tagArray) {
                    const tagId = await window.databaseAPI.addTag(tagName);
                    await window.databaseAPI.addTagToBook(bookId, tagId);
                }
            }
            
            // Reset form
            resetForm();
            
            // Reload books
            await loadBooks();
        } catch (err) {
            console.error('Error adding book:', err);
            alert('Failed to add book. Please try again.');
        }
    });
    
    // Close modal
    closeModal.addEventListener('click', () => {
        bookModal.style.display = 'none';
    });
    
    // Delete book
    deleteBookBtn.addEventListener('click', async () => {
        if (currentBookId && confirm('Are you sure you want to delete this book?')) {
            try {
                await window.databaseAPI.deleteBook(currentBookId);
                bookModal.style.display = 'none';
                await loadBooks();
            } catch (err) {
                console.error('Error deleting book:', err);
                alert('Failed to delete book. Please try again.');
            }
        }
    });
    
    // Open in external reader
    openExternalBtn.addEventListener('click', () => {
        alert('This would open the book in an external reader.');
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === bookModal) {
            bookModal.style.display = 'none';
        }
    });
    
    // Start server
    startServerBtn.addEventListener('click', async () => {
        const result = await window.databaseAPI.startWebServer();
        serverStatus.textContent = result.message;
    });
    
    // Stop server
    stopServerBtn.addEventListener('click', async () => {
        const result = await window.databaseAPI.stopWebServer();
        serverStatus.textContent = result.message;
    });
}

// Set up tabs in the modal
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabId}Tab`).classList.add('active');
        });
    });
}

// Open book details modal
async function openBookDetails(bookId) {
    try {
        currentBookId = bookId;
        const book = await window.databaseAPI.getBookById(bookId);
        const tags = await window.databaseAPI.getBookTags(bookId);
        
        modalBookTitle.textContent = book.title;
        modalBookAuthor.textContent = book.author;
        modalBookDescription.textContent = book.description || 'No description available.';
        
        if (book.cover_path) {
            modalBookCover.style.backgroundImage = `url("file://${book.cover_path}")`;
        } else {
            modalBookCover.style.backgroundImage = '';
            modalBookCover.style.backgroundColor = '#4a6da7';
        }
        
        // Render tags
        modalBookTags.innerHTML = '';
        tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'tag';
            tagElement.textContent = tag.name;
            modalBookTags.appendChild(tagElement);
        });
        
        // Show the modal
        bookModal.style.display = 'flex';
    } catch (err) {
        console.error('Error loading book details:', err);
    }
}

// Reset the add book form
function resetForm() {
    bookTitleInput.value = '';
    bookAuthorInput.value = '';
    bookDescriptionInput.value = '';
    bookTagsInput.value = '';
    selectedEpubPath = null;
    selectedCoverPath = null;
    selectedEpubFile.textContent = '';
    selectedCoverFile.textContent = '';
    updateAddButtonState();
    coverImage.innerHTML = window.databaseAPI.getCoverPlaceholder();

}

// Update the state of the add button
function updateAddButtonState() {
    const title = bookTitleInput.value.trim();
    const author = bookAuthorInput.value.trim();
    addBookBtn.disabled = !title || !author || !selectedEpubPath;
}

// Add input event listeners to update button state
bookTitleInput.addEventListener('input', updateAddButtonState);
bookAuthorInput.addEventListener('input', updateAddButtonState);

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', init);