document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication first
    if (!checkAuth()) {
        window.location.href = '../login.html';
        return;
    }

    async function checkAuth() {
        try {
            const response = await fetch('/api/auth/check', {
                credentials: 'include'
            });
            return response.ok;
        } catch (error) {
            console.error('Auth check failed:', error);
            return false;
        }
    }

    async function loadProfileData() {
        try {
            console.log('Loading profile data...');
            const response = await fetch('/api/teachers/profile', {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log('Profile response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Profile response error:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('Profile data received:', data);
            
            if (!data.success) {
                throw new Error(data.message || 'Failed to load profile');
            }

            const teacher = data.teacher;
            console.log('Teacher data:', teacher);
            
            // Populate form fields - check if elements exist first
            const firstName = document.getElementById('firstName');
            const lastName = document.getElementById('lastName');
            const email = document.getElementById('email');
            const phone = document.getElementById('phone');
            const birthDate = document.getElementById('birthDate');
            const speciality = document.getElementById('speciality');

            if (firstName) firstName.value = teacher.firstName || '';
            if (lastName) lastName.value = teacher.lastName || '';
            if (email) email.value = teacher.email || '';
            if (phone) phone.value = teacher.phone || '';
            if (speciality) speciality.value = teacher.speciality || '';
            if (birthDate) {
                birthDate.value = teacher.birthDate ? teacher.birthDate.split('T')[0] : '';
            }
            
            // Profile picture with cache busting
            const profilePicUrl = teacher.profilePhoto ? 
                `${teacher.profilePhoto}?${new Date().getTime()}` : 
                '../assets/images/default-profile.png';
            
            const profilePic = document.getElementById('profilePic');
            const navProfilePic = document.getElementById('navProfilePic');
            
            if (profilePic) profilePic.src = profilePicUrl;
            if (navProfilePic) navProfilePic.src = profilePicUrl;
            
            // Name display
            const fullName = `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
            const navFullName = document.getElementById('navFullName');
            const profileFullName = document.getElementById('profileFullName');
            
            if (navFullName) navFullName.textContent = fullName || 'Utilisateur';
            if (profileFullName) profileFullName.textContent = fullName || 'Utilisateur';
            
            // Display speciality if available
            const specialityElement = document.getElementById('profileSpeciality');
            if (specialityElement) {
                specialityElement.textContent = teacher.speciality || 'Enseignant';
            }
            
            // Display actual courses count - FIXED HERE
            const totalCoursesElement = document.getElementById('totalCourses');
            if (totalCoursesElement) {
                // Use the count from the API response, fallback to loading it separately
                if (teacher.coursesCount !== undefined) {
                    totalCoursesElement.textContent = teacher.coursesCount;
                } else {
                    // If not included in profile, load it separately
                    await loadCoursesCount();
                }
            }
            
            console.log('Profile loaded successfully');
            
        } catch (error) {
            console.error('Error loading profile:', error);
            showError('Erreur lors du chargement du profil: ' + error.message);
        }
    }

    // New function to load courses count separately
    async function loadCoursesCount() {
        try {
            console.log('Loading courses count...');
            const response = await fetch('/api/teachers/courses/count', {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                console.error('Failed to load courses count');
                return;
            }

            const data = await response.json();
            console.log('Courses count data:', data);
            
            if (data.success) {
                const totalCoursesElement = document.getElementById('totalCourses');
                if (totalCoursesElement) {
                    totalCoursesElement.textContent = data.count || 0;
                }
            }
        } catch (error) {
            console.error('Error loading courses count:', error);
            // Don't show error to user for this, just keep default value
        }
    }

    // Handle profile photo upload
    const profilePicInput = document.getElementById('profilePicInput');
    if (profilePicInput) {
        profilePicInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file type
            if (!file.type.startsWith('image/')) {
                showError('Veuillez sélectionner un fichier image valide');
                return;
            }

            // Validate file size (5MB max)
            if (file.size > 5 * 1024 * 1024) {
                showError('La taille du fichier ne doit pas dépasser 5MB');
                return;
            }

            const formData = new FormData();
            formData.append('profilePhoto', file);

            try {
                console.log('Uploading photo...');
                const response = await fetch('/api/teachers/profile/photo', {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });

                const result = await response.json();
                console.log('Upload response:', result);
                
                if (!result.success) {
                    throw new Error(result.message || 'Failed to upload photo');
                }

                // Update profile pictures with cache busting
                const newPhotoUrl = `${result.photoUrl}?${new Date().getTime()}`;
                const profilePic = document.getElementById('profilePic');
                const navProfilePic = document.getElementById('navProfilePic');
                
                if (profilePic) profilePic.src = newPhotoUrl;
                if (navProfilePic) navProfilePic.src = newPhotoUrl;
                
                showSuccess('Photo de profil mise à jour avec succès');
            } catch (error) {
                console.error('Error uploading photo:', error);
                showError('Erreur lors du téléchargement de la photo: ' + error.message);
            } finally {
                e.target.value = ''; // Reset file input
            }
        });
    }

    // Handle form submission
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Get form data
            const firstName = document.getElementById('firstName');
            const lastName = document.getElementById('lastName');
            const email = document.getElementById('email');
            const phone = document.getElementById('phone');
            const birthDate = document.getElementById('birthDate');
            const speciality = document.getElementById('speciality');

            // Validate required fields
            if (!firstName?.value.trim() || !lastName?.value.trim()) {
                showError('Le prénom et le nom sont obligatoires');
                return;
            }

            const formData = {
                firstName: firstName.value.trim(),
                lastName: lastName.value.trim(),
                email: email?.value.trim() || '',
                phone: phone?.value.trim() || '',
                birthDate: birthDate?.value || '',
                speciality: speciality?.value.trim() || ''
            };

            console.log('Submitting form data:', formData);

            try {
                const response = await fetch('/api/teachers/profile', {
                    method: 'PUT',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                console.log('Update response status:', response.status);

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'Failed to update profile');
                }

                const result = await response.json();
                console.log('Update result:', result);
                
                showSuccess('Profil mis à jour avec succès');
                
                // Update displayed name and speciality
                const fullName = `${formData.firstName} ${formData.lastName}`;
                const navFullName = document.getElementById('navFullName');
                const profileFullName = document.getElementById('profileFullName');
                const profileSpeciality = document.getElementById('profileSpeciality');
                
                if (navFullName) navFullName.textContent = fullName;
                if (profileFullName) profileFullName.textContent = fullName;
                if (profileSpeciality) profileSpeciality.textContent = formData.speciality || 'Enseignant';
                
            } catch (error) {
                console.error('Error updating profile:', error);
                showError('Erreur lors de la mise à jour du profil: ' + error.message);
            }
        });
    }

    // SweetAlert2 notification functions
    function showSuccess(message) {
        Swal.fire({
            icon: 'success',
            title: 'Succès',
            text: message,
            confirmButtonColor: '#5461FF',
            timer: 3000,
            timerProgressBar: true
        });
    }

    function showError(message) {
        Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: message,
            confirmButtonColor: '#5461FF'
        });
    }

    // Initial load
    console.log('Starting profile initialization...');
    await loadProfileData();
});