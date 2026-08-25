const form = document.getElementById("myForm");

const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const ageInput = document.getElementById("age");
const termsInput = document.getElementById("terms");
const maleInput = document.getElementById("male");
const femaleInput = document.getElementById("female");

// Error elements
const nameError = document.getElementById("nameError");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const ageError = document.getElementById("ageError");
const genderError = document.getElementById("genderError");
const termsError = document.getElementById("termsError");

// Helpers
function setValid(input) {
    input.classList.remove("invalid");
    input.classList.add("valid");
}

function setInvalid(input) {
    input.classList.remove("valid");
    input.classList.add("invalid");
}

// Validation functions

// NAME
function validateName() {
    if (nameInput.value.trim() === "") {
        nameError.textContent = "Name is required";
        setInvalid(nameInput);
        return false;
    }
    nameError.textContent = "";
    setValid(nameInput);
    return true;
}

// EMAIL
function validateEmail() {
    const email = emailInput.value.trim();
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (email === "") {
        emailError.textContent = "Email is required";
        setInvalid(emailInput);
        return false;
    }
    if (!pattern.test(email)) {
        emailError.textContent = "Enter a valid email address";
        setInvalid(emailInput);
        return false;
    }
    emailError.textContent = "";
    setValid(emailInput);
    return true;
}

// PASSWORD
function validatePassword() {
    if (passwordInput.value.length < 6) {
        passwordError.textContent = "Password must be at least 6 characters";
        setInvalid(passwordInput);
        return false;
    }
    passwordError.textContent = "";
    setValid(passwordInput);
    return true;
}

// AGE
function validateAge() {
    const age = Number(ageInput.value);
    if (!age || age <= 0) {
        ageError.textContent = "Enter a valid age";
        setInvalid(ageInput);
        return false;
    }
    ageError.textContent = "";
    setValid(ageInput);
    return true;
}

// GENDER   
function validateGender() {
    if (!maleInput.checked && !femaleInput.checked) {
        genderError.textContent = "Please select a gender";
        return false;
    }
    genderError.textContent = "";
    return true;
}

// TERMS
function validateTerms() {
    if (!termsInput.checked) {
        termsError.textContent = "You must accept the terms";
        return false;
    }
    termsError.textContent = "";
    return true;
}

// Live validation
nameInput.addEventListener("input", validateName);
emailInput.addEventListener("input", validateEmail);
passwordInput.addEventListener("input", validatePassword);
ageInput.addEventListener("input", validateAge);
maleInput.addEventListener("change", validateGender);
femaleInput.addEventListener("change", validateGender);
termsInput.addEventListener("change", validateTerms);

// Submit handler
form.addEventListener("submit", function (e) {
    e.preventDefault();

    const isValid =
        validateName() &
        validateEmail() &
        validatePassword() &
        validateAge() &
        validateGender() &
        validateTerms();

    if (!isValid) {
        return;
    }

    const formData = {
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        password: passwordInput.value,
        age: ageInput.value,
        gender: maleInput.checked ? "male" : "female",
        terms: termsInput.checked
    };

    // ✅ Option A: Save to localStorage
    localStorage.setItem("formData", JSON.stringify(formData));
    console.log("Saved to localStorage:", formData);

    // ✅ Option B: Send to server (example)
    fetch("/submit", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
    })
    .then(res => res.json())
    .then(data => {
        console.log("Server response:", data);
        alert("Form submitted successfully! 🎉");
        form.reset();
    })
    .catch(err => {
        console.error("Error sending data:", err);
        alert("Saved locally, but failed to send to server.");
    });
});
