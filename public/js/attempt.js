document.addEventListener('DOMContentLoaded', function() {
    const examForm = document.getElementById('examForm');
    const submitButton = document.getElementById('submitButton');
    const globalWarning = document.getElementById('globalWarning');
    const questionInputs = document.querySelectorAll('.question-input');
    const warningMessages = document.querySelectorAll('.unanswered-warning');
    const timerElement = document.getElementById('timer');
    
    let isValidating = false;

    // Use attempt start and end time
    const endTime = new Date(attempt.endTime).getTime();
    console.log('End time:', endTime);
    
    let timerInterval = null;

    function updateTimer() {
        const currentTime = new Date().getTime();
        const timeLeft = Math.floor((endTime - currentTime) / 1000); // Convert to seconds
        console.log('Time left in seconds:', timeLeft);

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerElement.innerHTML = "00:00:00";
            timerElement.style.color = 'red';
            disableAllInputs();
            examForm.submit();
            return;
        }

        const hours = Math.floor(timeLeft / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);
        const seconds = timeLeft % 60;

        // Warning colors
        if (hours === 0) {
            if (minutes === 0) {
                timerElement.style.color = '#dc3545'; // red color
                if (seconds < 10) {
                    timerElement.style.fontWeight = 'bold';
                }
            } else if (minutes === 1) {
                timerElement.style.color = '#ffc107'; // yellow color
            }
        }

        // Format time with leading zeros
        const formattedTime = 
            (hours < 10 ? "0" + hours : hours) + ":" +
            (minutes < 10 ? "0" + minutes : minutes) + ":" + 
            (seconds < 10 ? "0" + seconds : seconds);

        timerElement.innerHTML = formattedTime;
    }

    function disableAllInputs() {
        questionInputs.forEach(input => {
            input.disabled = true;
        });
        submitButton.disabled = true;
    }

    // Start the timer immediately
    updateTimer(); // Initial call
    timerInterval = setInterval(updateTimer, 1000);

    // Cleanup interval when page is unloaded
    window.addEventListener('beforeunload', function() {
        if (timerInterval) {
            clearInterval(timerInterval);
        }
    });

    function isQuestionAnswered(input) {
        if (input.type === 'radio') {
            const name = input.name;
            const radioGroup = document.querySelectorAll(`input[name="${name}"]`);
            return Array.from(radioGroup).some(radio => radio.checked);
        } else if (input.tagName.toLowerCase() === 'textarea') {
            return input.value.trim().length > 0;
        }
        return false;
    }

    function highlightUnansweredQuestions() {
        const processedQuestions = new Set();
        let hasUnanswered = false;
        let firstUnanswered = null;

        questionInputs.forEach(input => {
            const questionIndex = input.dataset.questionIndex;
            const name = input.name;

            if (!processedQuestions.has(name)) {
                processedQuestions.add(name);
                
                const isAnswered = isQuestionAnswered(input);
                const warningElement = warningMessages[questionIndex];
                const questionCard = document.getElementById(`question-card-${questionIndex}`);
                
                if (!isAnswered) {
                    hasUnanswered = true;
                    if (!firstUnanswered) {
                        firstUnanswered = questionCard;
                    }
                    
                    warningElement.classList.remove('d-none');
                    questionCard.classList.add('question-unanswered');
                    questionCard.classList.add('warning-shake');
                    
                    setTimeout(() => {
                        questionCard.classList.remove('warning-shake');
                    }, 1000);
                } else {
                    warningElement.classList.add('d-none');
                    questionCard.classList.remove('question-unanswered');
                }
            }
        });

        if (hasUnanswered) {
            globalWarning.classList.remove('d-none');
            globalWarning.classList.add('warning-shake');
            setTimeout(() => {
                globalWarning.classList.remove('warning-shake');
            }, 1000);
            
            if (firstUnanswered) {
                firstUnanswered.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else {
            globalWarning.classList.add('d-none');
        }
        
        submitButton.disabled = hasUnanswered;
        return !hasUnanswered;
    }

    function validateForm(event) {
        if (event) {
            event.preventDefault();
        }
        
        if (isValidating) {
            return false;
        }
        
        isValidating = true;
        const isValid = highlightUnansweredQuestions();
        
        if (isValid) {
            if (event) {
                const confirmSubmit = confirm('Are you sure you want to submit your exam?');
                if (confirmSubmit) {
                    questionInputs.forEach(input => {
                        localStorage.removeItem(`exam_${attempt._id}_${input.name}`);
                    });
                    examForm.submit();
                }
            }
        }
        
        isValidating = false;
        return false;
    }

    // Auto-save functionality
    questionInputs.forEach(input => {
        const savedValue = localStorage.getItem(`exam_${attempt._id}_${input.name}`);
        if (savedValue) {
            if (input.type === 'radio') {
                if (input.value === savedValue) {
                    input.checked = true;
                }
            } else {
                input.value = savedValue;
            }
        }

        input.addEventListener('change', function() {
            localStorage.setItem(`exam_${attempt._id}_${input.name}`, input.value);
            highlightUnansweredQuestions();
        });

        if (input.tagName.toLowerCase() === 'textarea') {
            input.addEventListener('input', function() {
                localStorage.setItem(`exam_${attempt._id}_${input.name}`, input.value);
                highlightUnansweredQuestions();
            });
        }
    });

    examForm.addEventListener('submit', validateForm);
});