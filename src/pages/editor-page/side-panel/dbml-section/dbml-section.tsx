import React from 'react';
import { AuthBlurGate } from '@/components/auth-blur-gate/auth-blur-gate';
import { TableDBML } from './table-dbml/table-dbml';

export interface DBMLSectionProps {}

export const DBMLSection: React.FC<DBMLSectionProps> = () => {
    return (
        <section
            className="flex flex-1 flex-col overflow-hidden px-2"
            data-vaul-no-drag
        >
            <div className="flex flex-1 flex-col overflow-hidden">
                <AuthBlurGate>
                    <TableDBML />
                </AuthBlurGate>
            </div>
        </section>
    );
};
