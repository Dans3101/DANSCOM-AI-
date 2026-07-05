import { menus } from '../data/menuData.js';

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
