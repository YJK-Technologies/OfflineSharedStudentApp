import React, { useState, useEffect } from 'react';

export default function StudentForm({ studentToEdit, isOpen, onClose, onSave }) {
  const isEditing = Boolean(studentToEdit && studentToEdit.id);

  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: ''
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (studentToEdit) {
      setFormData({
        name: studentToEdit.name || '',
        mobile: studentToEdit.mobile || '',
        email: studentToEdit.email || ''
      });
    } else {
      setFormData({
        name: '',
        mobile: '',
        email: ''
      });
    }
    setErrors({});
  }, [studentToEdit, isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    }
    if (!formData.mobile.trim()) {
      newErrors.mobile = 'Mobile phone number is required';
    } else if (!/^[0-9+\s-]{7,15}$/.test(formData.mobile.trim())) {
      newErrors.mobile = 'Enter a valid phone number (digits, optional +, hyphens)';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = 'Enter a valid email address';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSave({
        ...formData,
        id: isEditing ? studentToEdit.id : undefined
      });
      onClose();
    } catch (err) {
      setErrors({ form: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing ? 'Edit Student' : 'Add New Student'}
          </h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="student-form">
          {errors.form && (
            <div className="form-error-banner">
              <span>{errors.form}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="student-name" className="form-label">
              Student Full Name <span className="required">*</span>
            </label>
            <input
              id="student-name"
              type="text"
              className={`form-input ${errors.name ? 'input-error' : ''}`}
              placeholder="e.g. Arun Kumar"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              autoFocus
            />
            {errors.name && <span className="field-error-text">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="student-mobile" className="form-label">
              Mobile Number <span className="required">*</span>
            </label>
            <input
              id="student-mobile"
              type="tel"
              className={`form-input ${errors.mobile ? 'input-error' : ''}`}
              placeholder="e.g. 9876543210"
              value={formData.mobile}
              onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            />
            {errors.mobile && <span className="field-error-text">{errors.mobile}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="student-email" className="form-label">
              Email Address <span className="required">*</span>
            </label>
            <input
              id="student-email"
              type="email"
              className={`form-input ${errors.email ? 'input-error' : ''}`}
              placeholder="e.g. arun.kumar@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            {errors.email && <span className="field-error-text">{errors.email}</span>}
          </div>

          <div className="form-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving to Local SQLite...' : (isEditing ? 'Save Changes' : 'Create Student')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
