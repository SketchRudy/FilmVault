document.getElementById('movie-form').onsubmit = () => {

    clearErrors();
    let isValid = true;

    // Validate title
    let title = document.getElementById('title').value.trim();
    if (title === "") {
        document.getElementById("err-title").style.display = "block";
        isValid = false;
    }

    // Validate director
    let director = document.getElementById('director').value.trim();
    if (director === "") {
        document.getElementById("err-director").style.display = "block";
        isValid = false;
    }

    // Validate year
    let year = document.getElementById('year').value.trim();
    if (year === "") {
        document.getElementById("err-year").style.display = "block";
        isValid = false;
    }
    
    // Validate genre
    let genre = document.getElementById('genre').value;
    if (genre === "none") {
        document.getElementById("err-genre").style.display = "block";
        isValid = false;
    }

    return isValid;
}

function clearErrors() {
    let errors = document.getElementsByClassName("err");
    for (let i=0; i<errors.length; i++) {
        errors[i].style.display = "none";
    }
}


