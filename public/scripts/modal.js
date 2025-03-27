let movieToDelete = null; // store the ID of the movie to delete

// Function to open the modal and store movieID
function openDeleteModal(movieID) {
    movieToDelete = movieID;
    document.getElementById('deleteModal').style.display = 'block';
}

// Function to close the modal and reset stored ID
function closeDeleteModal() {
    movieToDelete = null;
    document.getElementById('deleteModal').style.display = 'none';
}

// Attach event listeners to the modal buttons once DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const confirmButton = document.getElementById('confirmDelete');
    const cancelButton = document.getElementById('cancelDelete');

    // If confirm button is clicked, call DELETE endpoint
    confirmButton.addEventListener('click', function() {
        if (movieToDelete) {
            fetch(`/movie/${movieToDelete}`, { method: `DELETE` })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Remove the element from DOM
                    const movieElement = document.getElementById('movie-' + movieToDelete);
                    if (movieElement) {
                        // Remove the movies genre if empty
                        const genreSection = movieElement.closest('.genre-section');
                        movieElement.remove();
                        if (genreSection && !genreSection.querySelector('.movie-entry')) {
                            genreSection.remove();
                        }
                    }
                } else {
                    alert ("Failed to delete the movie, please try again");
                }
                closeDeleteModal();
            })
            .catch(error => {
                console.error("Error deleting movie:", error);
                alert("An error occurred while deleting the movie.");
                closeDeleteModal();
            });
        }
    });

    // If cancel button is clicked, close the modal
    cancelButton.addEventListener('click', function() {
        closeDeleteModal();
    }) 

    // Close the modal if the user clicks outside the modal content
    window.addEventListener('click', function(event) {
        const modal = this.document.getElementById('deleteModal');
        if (event.target === modal) {
            closeDeleteModal();
        }
    })
})
