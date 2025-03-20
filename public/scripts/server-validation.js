export function validateForm(data) {
    const errors = [];

    // 1. Validate title
    if (!data.title || data.title.trim() === "") {
        errors.push("Title Required");
    }

    // 2. Validate director
    if (!data.director || data.director.trim() === "") {
        errors.push("Director Required");
    }

    // 3. Validate year
    if (!data.year || data.year.trim() === "") {
        errors.push("Year Required")
    }

    // 4. Validate genre
    if (!data.genre || data.genre.trim() === "") {
        errors.push("Genre Required")
    }

    // 5. Validate rating
    if (!data.rating) {
        errors.push("Rating Invalid")
    }
    return {
        isValid: errors.length === 0,
        errors
    }
}