

// Global variables
let selectedEpubPath = null;
let selectedCoverPath = null;
let currentBookId = null;
let books = [];
let metaData = null;
let modalSelectedBook = null;


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
const coverImage = document.getElementById('selectedCoverImage')
const addBookBtnLabel = document.getElementById('addBookBtnLabel')
const resetBtn = document.getElementById('resetBtn');
const dropZone = document.getElementById('drop-zone');
const reader = document.getElementById('reader');








// Initialize the application
async function init() {
    await loadBooks();
    setupEventListeners();
    setupTabs();
    placeHolderCover();

}

async function placeHolderCover(){
    const coverPlaceHolder = await window.databaseAPI.getCoverPlaceholder();
    coverImage.src = coverPlaceHolder;

}


// Load books from the database
async function loadBooks() {
    try {
        books = await window.databaseAPI.getBooks();
        console.log("Loaded books from DB:", books.length);
        renderBooks();
    } catch (err) {
        console.error('Error loading books:', err);
    }
}

async function renderBooks() {
    bookGrid.innerHTML = '';
    
    if (books.length === 0) {
      bookGrid.innerHTML = '<p>No books in your library yet. Add your first book using the form on the left.</p>';
      return;
    }
    
    // Use a for...of loop so we can use await for each cover fetch.
    for (const book of books) {
      const bookCard = document.createElement('div');
      bookCard.className = 'book-card';
      bookCard.dataset.id = book.id;
      
      let coverStyle = 'background-color: #4a6da7'; // fallback style
      
      if (book.cover_path) {
        try {
          // Get the cover image as a data URL via IPC
          const coverDataUrl = await window.databaseAPI.getBookCover(book.id);
          if (coverDataUrl) {
            coverStyle = `background-image: url('${coverDataUrl}')`;
            console.log("Got a book cover");
          }
          else{
            console.log("No book cover");
          }
        } catch (error) {
          console.error('Error fetching cover for book', book.id, error);
        }
      }
      
      bookCard.innerHTML = `
        <div class="book-cover" style="${coverStyle}"></div>
        <div class="book-info">
          <h3 class="book-title">${book.title}</h3>
          <p class="book-author">${book.author}</p>
        </div>
      `;
      
      bookCard.addEventListener('click', () => openBookDetails(book.id));
      bookGrid.appendChild(bookCard);
    }
    console.log("Rendered books count:", bookGrid.childNodes.length);

  }

// Helper function
async function extractMetaData(epubPath) {

    console.log("Calling extractMetaData with path:", epubPath);
    if (!epubPath) {
        console.error("ExtractMetaData received undefined path!");
        return;
    }

    metaData = await window.databaseAPI.extractMetaData(epubPath);
    console.log("Metadata received:", metaData);
    return metaData; // metaData is a plain JS object
}


async function renderBook(book) {
    // Create a new card for the book.
    const bookCard = document.createElement('div');
    bookCard.className = 'book-card';
    bookCard.dataset.id = book.id;
    
    // Start with a fallback style.
    let coverStyle = 'background-color: #4a6da7';
    
    // If the book has a cover, fetch its data URL.
    if (book.cover_path) {
      try {
        const coverDataUrl = await window.databaseAPI.getBookCover(book.id);
        if (coverDataUrl) {
          coverStyle = `background-image: url('${coverDataUrl}')`;
        }
      } catch (error) {
        console.error('Error fetching cover for book', book.id, error);
      }
    }
    
    bookCard.innerHTML = `
      <div class="book-cover" style="${coverStyle}"></div>
      <div class="book-info">
        <h3 class="book-title">${book.title}</h3>
        <p class="book-author">${book.author}</p>
      </div>
    `;
    
    // Open book details when clicked.
    bookCard.addEventListener('click', () => openBookDetails(book.id));
    
    // Append the new card to the book grid.
    bookGrid.appendChild(bookCard);
  }


async function handleEpubDrag(file) {
    if (file.path) {
      const result = await window.databaseAPI.handleEpubDrag({ path: file.path });
      await renderBook({
        id: result.bookId,
        ...result.metadata
      });
      console.log(result);
    } else {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
              try {
                const arrayBuffer = e.target.result;
                const result = await window.databaseAPI.handleEpubDrag({ data: arrayBuffer });
                console.log(result);
                // Immediately render the new book.
                await renderBook({
                  id: result.bookId,
                  ...result.metadata
                });
                resolve(result);
              } catch (err) {
                reject(err);
              }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
          });
    
  }}


// Set up event listeners
function setupEventListeners() {
    console.log("setting up event listeners")

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("hover");
        e.dataTransfer.dropEffect = "copy";
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("hover");
    });

    dropZone.addEventListener("drop", async(e) => {
        console.log("Drop event triggered");

        e.preventDefault();
        dropZone.classList.remove("hover");
    
        const files = e.dataTransfer.files;
    
        const promises = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.name.endsWith(".epub")) {
            console.log("EPUB file dropped:", file.name);
            promises.push(handleEpubDrag(file));
            } else {
            console.warn("Not an EPUB:", file.name);
            }
        }
        
        // Wait until all files are processed
        await Promise.all(promises);
        
        // Then re-render the library once
        await loadBooks();

    });
    

    // Select EPUB file
    selectEpubBtn.addEventListener('click', async () => {
        const fileInfo = await window.databaseAPI.selectEpubFile();
        const { sourcePath } = fileInfo;

        console.log('Selected EPUB Path:', sourcePath); 

        if (sourcePath) {
            selectedEpubFile.textContent = sourcePath.split('/').pop();
            try {
                const metaData = await extractMetaData(sourcePath);
                bookTitleInput.value = metaData.title;
                bookAuthorInput.value = metaData['author'];
                bookDateInput.value = metaData['date'];
                coverImage.src = `data:${metaData.cover.mimeType};base64,${metaData.cover.data}`;
                selectedCoverFile.textContent = "Extracted from EPUB file";
                selectedEpubPath = sourcePath;
                addBookBtnLabel.innerText = `Destination Path 
                ${metaData.title} - ${metaData.author}.epub`;

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
            coverImage.src = `${selectedCoverPath}`;
        }
    });

    resetBtn.addEventListener('click', async () => {
        resetForm();
    });
    
    // Add book
    addBookBtn.addEventListener('click', async () => {
        console.log("Add book button clicked")
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
                coverPath: selectedCoverPath,
                coverImage: `data:${metaData.cover.mimeType};base64,${metaData.cover.data}`
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
    
    async function loadBook() {
      const bookPath = modalSelectedBook.file_path;
      console.log("Loaded book from modal:", modalSelectedBook.file_path);
      await window.readerAPI.openReaderWindow(bookPath);

    }
    
    
    // Open in external reader
    openExternalBtn.addEventListener('click', () => {
        
      loadBook();

    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === bookModal) {
            bookModal.style.display = 'none';
        }
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
        modalSelectedBook = await window.databaseAPI.getBookById(bookId);
        const tags = await window.databaseAPI.getBookTags(bookId);
        
        modalBookTitle.textContent = modalSelectedBook.title;
        modalBookAuthor.textContent = modalSelectedBook.author;
        modalBookDescription.textContent = modalSelectedBook.description || 'No description available.';

        if (modalSelectedBook.cover_path) {
            try {
              // Get the cover image as a data URL via IPC
              const coverDataUrl = await window.databaseAPI.getBookCover(modalSelectedBook.id);
              if (coverDataUrl) {
                modalBookCover.style.backgroundImage = `url('${coverDataUrl}')`;
              }
              else{
                modalBookCover.style.backgroundImage = '';
                modalBookCover.style.backgroundColor = '#4a6da7';
              }
            } catch (error) {
              console.error('Error fetching cover for book', modalSelectedBook.id, error);
            }
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
    coverImage.innerHTML = window.databaseAPI.getCoverPlaceholder();
    updateAddButtonState();
    addBookBtnLabel.value = "Destination Path"
    placeHolderCover();

}

// Update the state of the add button
function updateAddButtonState() {
    console.log("updateAddButtonState")
    const title = bookTitleInput.value.trim();
    const author = bookAuthorInput.value.trim();
    addBookBtn.disabled = !title || !author || !selectedEpubPath;
    addBookBtnLabel.innerText = `Destination Path
    ${title} - ${author}`;

}

// Add input event listeners to update button state
bookTitleInput.addEventListener('input', updateAddButtonState);
bookAuthorInput.addEventListener('input', updateAddButtonState);

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', init);