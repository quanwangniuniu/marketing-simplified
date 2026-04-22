'use client';

import { useState } from 'react';
import { X, Plus, Mail, Loader2 } from 'lucide-react';
import useStripe from '@/hooks/useStripe';
import toast from 'react-hot-toast';

interface InviteMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvited?: () => void;
}

export default function InviteMembersModal({ isOpen, onClose, onInvited }: InviteMembersModalProps) {
  const [emails, setEmails] = useState<string[]>(['']);
  const [currentEmail, setCurrentEmail] = useState('');
  const { inviteUsersToOrganization, inviteUsersLoading } = useStripe();

  if (!isOpen) return null;

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const addEmail = () => {
    const trimmedEmail = currentEmail.trim();
    if (!trimmedEmail) return;
    
    if (!validateEmail(trimmedEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    if (emails.includes(trimmedEmail)) {
      toast.error('This email is already added');
      return;
    }
    
    setEmails([...emails.filter(email => email !== ''), trimmedEmail, '']);
    setCurrentEmail('');
  };

  const removeEmail = (indexToRemove: number) => {
    const newEmails = emails.filter((_, index) => index !== indexToRemove);
    setEmails(newEmails.length === 0 ? [''] : newEmails);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail();
    }
  };

  const handleSubmit = async () => {
    const validEmails = emails.filter(email => email.trim() !== '' && validateEmail(email.trim()));
    
    if (validEmails.length === 0) {
      toast.error('Please add at least one valid email address');
      return;
    }

    try {
      await inviteUsersToOrganization(validEmails);
      validEmails.length > 1 ? toast.success(`${validEmails.length} users invited successfully!`) : toast.success(`1 user invited successfully!`);
      if (onInvited) onInvited();
      onClose();
      // Reset form
      setEmails(['']);
      setCurrentEmail('');
    } catch (error) {
      // Error is already handled in the hook
      console.error('Failed to invite users:', error);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset form
    setEmails(['']);
    setCurrentEmail('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto p-0 relative">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-green-500 to-[#3CCED7] p-6 rounded-t-lg flex justify-between items-center">
          <h3 className="text-xl font-bold text-white">Invite Team Members</h3>
          <button onClick={handleClose} className="text-white hover:text-gray-200">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          <div className="text-sm font-semibold mb-4">
            Add email addresses to invite new members to your organization.
          </div>

          {/* Email Input */}
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700">
              Email Address
            </label>
            <div className="flex space-x-2">
              <input
                type="email"
                id="email"
                value={currentEmail}
                onChange={(e) => setCurrentEmail(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter email address"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-[#3CCED7] focus:border-[#3CCED7] sm:text-sm"
                disabled={inviteUsersLoading}
              />
              <button
                type="button"
                onClick={addEmail}
                disabled={inviteUsersLoading || !currentEmail.trim()}
                className="px-4 py-2 bg-[#3CCED7] text-white rounded-md hover:bg-[#2AB5BD] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3CCED7] disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Email List */}
          {emails.filter(email => email.trim() !== '').length > 0 && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Users to Invite ({emails.filter(email => email.trim() !== '').length})
              </label>
              <div className="max-h-32 overflow-y-auto space-y-2">
                {emails.map((email, index) => {
                  if (email.trim() === '') return null;
                  const isValid = validateEmail(email.trim());
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-2 rounded-md border ${
                        isValid ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Mail className={`w-4 h-4 ${isValid ? 'text-green-600' : 'text-red-600'}`} />
                        <span className={`text-sm ${isValid ? 'text-green-800' : 'text-red-800'}`}>
                          {email}
                        </span>
                        {!isValid && (
                          <span className="text-xs text-red-600">Invalid email</span>
                        )}
                      </div>
                      <button
                        onClick={() => removeEmail(index)}
                        disabled={inviteUsersLoading}
                        className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end space-x-3 p-6 pt-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3CCED7]"
            disabled={inviteUsersLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            disabled={inviteUsersLoading || emails.filter(email => email.trim() !== '' && validateEmail(email.trim())).length === 0}
          >
            {inviteUsersLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Invitations
          </button>
        </div>
      </div>
    </div>
  );
}
