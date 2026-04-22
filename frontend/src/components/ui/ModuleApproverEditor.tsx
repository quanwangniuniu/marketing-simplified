import React, { useState, useEffect } from 'react';
import { useApproverData } from '@/hooks/useApproverData';
import ApproverSelect from './ApproverSelect';
import { ApproverUser } from '@/types/approver';

interface ModuleApproverEditorProps {
  module: string; // 'ASSET' | 'CAMPAIGN' | 'BUDGET' | 'REPORTING'
  moduleName?: string;
  moduleDescription?: string;
}

const ModuleApproverEditor: React.FC<ModuleApproverEditorProps> = ({
  module,
  moduleName = 'Module',
  moduleDescription = '',
}) => {
  const { users, approvers, setApprovers, loading, error } = useApproverData(module);
  const [selectedUsers, setSelectedUsers] = useState<ApproverUser[]>([]);

  useEffect(() => {
    setSelectedUsers(approvers);
  }, [approvers]);

  const handleSave = async () => {
    await setApprovers(selectedUsers.map(u => u.id));
  };

  const handleCancel = () => {
    setSelectedUsers(approvers);
  };

  return (
    <div className="bg-white rounded shadow p-6">
      <div className="mb-2 flex items-center">
        <h2 className="text-xl font-semibold">{moduleName}</h2>
        <span className="ml-2 text-gray-500">{moduleDescription}</span>
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <>
          <ApproverSelect
            users={users}
            value={selectedUsers}
            onChange={setSelectedUsers}
            placeholder="Search and select users..."
            className="w-full"
          />
          <div className="mt-4 flex gap-2">
            <button
              className="bg-[#3CCED7] text-white px-4 py-2 rounded"
              onClick={handleSave}
              disabled={loading}
            >
              Save
            </button>
            <button
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ModuleApproverEditor;