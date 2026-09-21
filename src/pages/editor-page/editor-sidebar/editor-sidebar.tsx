import React, { useMemo } from 'react';
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/sidebar/sidebar';
import {
    Group,
    FileType,
    Plus,
    FolderOpen,
    CodeXml,
    FileCode,
} from 'lucide-react';
import { Table, Workflow } from 'lucide-react';
import { useLayout } from '@/hooks/use-layout';
import { useTranslation } from 'react-i18next';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import ChartDBLogo from '@/assets/sqllab-logo-light.svg';
import ChartDBDarkLogo from '@/assets/sqllab-logo-dark.svg';
import { useTheme } from '@/hooks/use-theme';
import { useChartDB } from '@/hooks/use-chartdb';
import { supportsCustomTypes } from '@/lib/domain/database-capabilities';
import { useCreateEmptyDiagram } from '@/hooks/use-create-empty-diagram';
import { useDialog } from '@/hooks/use-dialog';
import { Separator } from '@/components/separator/separator';

export interface SidebarItem {
    title: string;
    icon: React.FC;
    onClick: () => void;
    active: boolean;
    badge?: string;
}

export interface EditorSidebarProps {}

export const EditorSidebar: React.FC<EditorSidebarProps> = () => {
    const {
        selectSidebarSection,
        selectedSidebarSection,
        showSidePanel,
        selectVisualsTab,
    } = useLayout();
    const { t } = useTranslation();
    const { isMd: isDesktop } = useBreakpoint('md');
    const { effectiveTheme } = useTheme();
    const { databaseType } = useChartDB();
    const { openOpenDiagramDialog } = useDialog();
    const { createEmptyDiagram } = useCreateEmptyDiagram();

    const diagramItems: SidebarItem[] = useMemo(
        () => [
            {
                title: t('editor_sidebar.new_diagram'),
                icon: Plus,
                onClick: () => {
                    void createEmptyDiagram();
                },
                active: false,
            },
            {
                title: t('editor_sidebar.browse'),
                icon: FolderOpen,
                onClick: () => {
                    openOpenDiagramDialog();
                },
                active: false,
            },
        ],
        [t, createEmptyDiagram, openOpenDiagramDialog]
    );

    const baseItems: SidebarItem[] = useMemo(
        () => [
            {
                title: t('editor_sidebar.tables'),
                icon: Table,
                onClick: () => {
                    showSidePanel();
                    selectSidebarSection('tables');
                },
                active: selectedSidebarSection === 'tables',
            },
            {
                title: 'DBML',
                icon: CodeXml,
                onClick: () => {
                    showSidePanel();
                    selectSidebarSection('dbml');
                },
                active: selectedSidebarSection === 'dbml',
            },
            {
                title: 'DDL',
                icon: FileCode,
                onClick: () => {
                    showSidePanel();
                    selectSidebarSection('ddl');
                },
                active: selectedSidebarSection === 'ddl',
            },
            {
                title: t('editor_sidebar.refs'),
                icon: Workflow,
                onClick: () => {
                    showSidePanel();
                    selectSidebarSection('refs');
                },
                active: selectedSidebarSection === 'refs',
            },
            ...(supportsCustomTypes(databaseType)
                ? [
                      {
                          title: t('editor_sidebar.custom_types'),
                          icon: FileType,
                          onClick: () => {
                              showSidePanel();
                              selectSidebarSection('customTypes');
                          },
                          active: selectedSidebarSection === 'customTypes',
                      },
                  ]
                : []),
            {
                title: t('editor_sidebar.visuals'),
                icon: Group,
                onClick: () => {
                    showSidePanel();
                    selectSidebarSection('visuals');
                    selectVisualsTab('areas');
                },
                active: selectedSidebarSection === 'visuals',
            },
        ],
        [
            selectSidebarSection,
            selectedSidebarSection,
            t,
            showSidePanel,
            databaseType,
            selectVisualsTab,
        ]
    );

    return (
        <Sidebar
            side="left"
            collapsible="icon-extended"
            variant="sidebar"
            className="relative h-full"
        >
            {!isDesktop ? (
                <SidebarHeader>
                    <a
                        href="https://sqllab.ru"
                        className="cursor-pointer"
                        rel="noreferrer"
                    >
                        <img
                            src={
                                effectiveTheme === 'light'
                                    ? ChartDBLogo
                                    : ChartDBDarkLogo
                            }
                            alt="SQL Lab"
                            className="h-4 max-w-fit"
                        />
                    </a>
                </SidebarHeader>
            ) : null}
            <SidebarContent>
                <SidebarGroup>
                    {/* <SidebarGroupLabel /> */}
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {diagramItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        className="justify-center space-y-0.5 !px-0 hover:bg-gray-200 data-[active=true]:bg-gray-100 data-[active=true]:text-pink-600 data-[active=true]:hover:bg-pink-100 dark:hover:bg-gray-800 dark:data-[active=true]:bg-gray-900 dark:data-[active=true]:text-pink-400 dark:data-[active=true]:hover:bg-pink-950"
                                        isActive={item.active}
                                        asChild
                                    >
                                        <button onClick={item.onClick}>
                                            <item.icon />
                                            <span>
                                                {item.title
                                                    .split(' ')
                                                    .map((word, index) => (
                                                        <div key={index}>
                                                            {word}
                                                        </div>
                                                    ))}
                                            </span>
                                        </button>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                        <Separator className="my-2" />
                        <SidebarMenu>
                            {baseItems.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        className="justify-center space-y-0.5 !px-0 hover:bg-gray-200 data-[active=true]:bg-gray-100 data-[active=true]:text-pink-600 data-[active=true]:hover:bg-pink-100 dark:hover:bg-gray-800 dark:data-[active=true]:bg-gray-900 dark:data-[active=true]:text-pink-400 dark:data-[active=true]:hover:bg-pink-950"
                                        isActive={item.active}
                                        asChild
                                    >
                                        <button onClick={item.onClick}>
                                            <item.icon />
                                            <span>
                                                {item.title
                                                    .split(' ')
                                                    .map((word, index) => (
                                                        <div key={index}>
                                                            {word}
                                                        </div>
                                                    ))}
                                            </span>
                                        </button>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
};
