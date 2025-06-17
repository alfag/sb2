document.addEventListener('DOMContentLoaded', function () {
    const roleSelect = document.getElementById('role');
    const customerDetails = document.getElementById('customerDetails');
    const administratorDetails = document.getElementById('administratorDetails');
    const breweryDetails = document.getElementById('breweryDetails');

    roleSelect.addEventListener('change', function () {
        const selectedRole = roleSelect.value;

        customerDetails.style.display = 'none';
        administratorDetails.style.display = 'none';
        breweryDetails.style.display = 'none';

        if (selectedRole === 'customer') {
            customerDetails.style.display = 'block';
        } else if (selectedRole === 'administrator') {
            administratorDetails.style.display = 'block';
        } else if (selectedRole === 'brewery') {
            breweryDetails.style.display = 'block';
        }
    });
});
