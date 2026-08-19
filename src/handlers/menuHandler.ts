export interface MenuItem {
    command: string;
    description: string;
}

export interface Menu {
    icon: string;
    title: string;
    items: MenuItem[];
}

export const menus: Record<string, Menu> = {
    main: {
        icon: '🤖',
        title: 'DANSCOM BOT MENU',
        items: [
            { command: '.menu', description: 'Show main menu' },
            { command: '.qr', description: 'Generate QR code' },
            { command: '.status', description: 'Check bot status' },
            { command: '.checksub', description: 'Verify subscription' },
            { command: '.help', description: 'Get assistance' }
        ]
    },
    tools: {
        icon: '🛠️',
        title: 'UTILITIES',
        items: [
            { command: '.ping', description: 'Check latency' },
            { command: '.ai', description: 'Ask AI assistant' },
            { command: '.weather', description: 'Get weather forecast' }
        ]
    }
};

export const getMenuText = (menuId: string): string => {
    const menu = menus[menuId];
    if (!menu) {
        return `⚠️ Menu *${menuId}* not found.`;
    }

    let menuText = `╔════════════════════════╗
║  ${menu.icon}  *${menuId}. ${menu.title}*  ║
╚════════════════════════╝\n`;
    
    menu.items.forEach(item => {
        menuText += `│ ${item.command.padEnd(10)} - ${item.description.padEnd(15)} │\n`;
    });
    
    menuText += `└────────────────────────┘`;
    
    return menuText;
};
