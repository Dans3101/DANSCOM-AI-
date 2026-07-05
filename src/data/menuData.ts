export const menus: Record<string, { title: string, icon: string, items: { command: string, description: string }[] }> = {
    "10": {
        title: "GAMES MENU",
        icon: "🎮",
        items: [
            { command: ".wordguess", description: "Word Guess Game" },
            { command: ".trivia", description: "Trivia Quiz" },
            { command: ".numguess", description: "Number Guessing" },
            { command: ".hangman", description: "Hangman Game" },
            { command: ".chess", description: "Chess vs Bot" },
            { command: ".riddle", description: "Daily Riddle" },
            { command: ".tictactoe", description: "Tic Tac Toe" },
            { command: ".rps", description: "Rock Paper Sciss" },
            { command: ".dice", description: "Roll Dice" },
            { command: ".leaderboard", description: "Top Players" },
            { command: ".score", description: "My Score" }
        ]
    },
    "11": {
        title: "GENERAL MENU",
        icon: "🌍",
        items: [
            { command: ".time", description: "Current Time" },
            { command: ".date", description: "Current Date" },
            { command: ".calc", description: "Calculator" },
            { command: ".qr", description: "Generate QR Code" },
            { command: ".shorturl", description: "Shorten URL" },
            { command: ".encode", description: "Encode Text" },
            { command: ".decode", description: "Decode Text" },
            { command: ".color", description: "Color Picker" },
            { command: ".emoji", description: "Emoji Search" },
            { command: ".ascii", description: "ASCII Art Text" },
            { command: ".reverse", description: "Reverse Text" },
            { command: ".countdown", description: "Set Countdown" }
        ]
    },
    "12": {
        title: "NEWS MENU",
        icon: "📰",
        items: [
            { command: ".breaking", description: "Breaking News" },
            { command: ".sportnews", description: "Sports News" },
            { command: ".technews", description: "Tech News" },
            { command: ".biznews", description: "Business News" },
            { command: ".worldnews", description: "World News" },
            { command: ".enews", description: "Entertainment" },
            { command: ".healthnews", description: "Health News" },
            { command: ".localnews", description: "News by Region" },
            { command: ".headline", description: "Top Headlines" },
            { command: ".newsearch", description: "Search News" }
        ]
    },
    "13": {
        title: "WEATHER MENU",
        icon: "🌤️",
        items: [
            { command: ".weather", description: "Current Weather" },
            { command: ".forecast", description: "7-Day Forecast" },
            { command: ".rain", description: "Rain Alert" },
            { command: ".temp", description: "Temperature" },
            { command: ".wind", description: "Wind Speed" },
            { command: ".uv", description: "UV Index" },
            { command: ".humidity", description: "Humidity Level" },
            { command: ".storm", description: "Storm Alerts" },
            { command: ".airquality", description: "Air Quality Index" },
            { command: ".sunrise", description: "Sunrise & Sunset" }
        ]
    },
    "14": {
        title: "INFORMATION",
        icon: "📄",
        items: [
            { command: ".wiki", description: "Wikipedia Search" },
            { command: ".define", description: "Word Definition" },
            { command: ".country", description: "Country Info" },
            { command: ".capital", description: "Country Capital" },
            { command: ".flag", description: "Country Flag" },
            { command: ".population", description: "Population Data" },
            { command: ".currency", description: "Currency Info" },
            { command: ".timezone", description: "Timezone Info" },
            { command: ".language", description: "Languages Spoken" },
            { command: ".continent", description: "Continent Facts" }
        ]
    },
    "15": {
        title: "SPORTS MENU",
        icon: "⚽",
        items: [
            { command: ".livescore", description: "Live Scores" },
            { command: ".fixtures", description: "Upcoming Games" },
            { command: ".standings", description: "League Table" },
            { command: ".transfer", description: "Transfer News" },
            { command: ".player", description: "Player Stats" },
            { command: ".team", description: "Team Info" },
            { command: ".highlights", description: "Match Highlights" },
            { command: ".topscorer", description: "Top Scorers" },
            { command: ".nba", description: "NBA Updates" },
            { command: ".nfl", description: "NFL Updates" },
            { command: ".tennis", description: "Tennis Updates" },
            { command: ".f1", description: "Formula 1 News" }
        ]
    },
    "16": {
        title: "HEALTH MENU",
        icon: "🧘",
        items: [
            { command: ".bmi", description: "BMI Calculator" },
            { command: ".water", description: "Water Tracker" },
            { command: ".workout", description: "Workout Tips" },
            { command: ".diet", description: "Diet Advice" },
            { command: ".sleep", description: "Sleep Tips" },
            { command: ".meditate", description: "Meditation Guide" },
            { command: ".calories", description: "Calorie Checker" },
            { command: ".symptom", description: "Symptom Checker" },
            { command: ".mentalhealth", description: "Mental Tips" },
            { command: ".heartrate", description: "Heart Rate Guide" },
            { command: ".steps", description: "Daily Step Goal" }
        ]
    },
    "17": {
        title: "FOOD MENU",
        icon: "🍔",
        items: [
            { command: ".recipe", description: "Find a Recipe" },
            { command: ".calories", description: "Calorie Count" },
            { command: ".meal", description: "Meal Planner" },
            { command: ".foodfact", description: "Food Fun Facts" },
            { command: ".dessert", description: "Dessert Ideas" },
            { command: ".drink", description: "Drink Recipes" },
            { command: ".cuisine", description: "Cuisine by Country" },
            { command: ".shopping", description: "Shopping List" },
            { command: ".nutrition", description: "Nutrition Info" },
            { command: ".vegan", description: "Vegan Recipes" },
            { command: ".random", description: "Random Recipe" }
        ]
    },
    "18": {
        title: "TRAVEL MENU",
        icon: "🗺️",
        items: [
            { command: ".countryinfo", description: "Country Guide" },
            { command: ".visa", description: "Visa Info" },
            { command: ".timezone", description: "Time Converter" },
            { command: ".phrase", description: "Local Phrases" },
            { command: ".convert", description: "Currency Conv." },
            { command: ".hotel", description: "Find Hotels" },
            { command: ".maps", description: "Get Directions" },
            { command: ".warning", description: "Travel Warning" },
            { command: ".embassy", description: "Embassy Info" },
            { command: ".flight", description: "Flight Tracker" },
            { command: ".attractions", description: "Top Attractions" }
        ]
    },
    "19": {
        title: "FINANCE MENU",
        icon: "💰",
        items: [
            { command: ".convert", description: "Currency Convert" },
            { command: ".crypto", description: "Crypto Prices" },
            { command: ".stock", description: "Stock Price" },
            { command: ".loan", description: "Loan Calculator" },
            { command: ".forex", description: "Forex Rates" },
            { command: ".savings", description: "Savings Calc" },
            { command: ".tax", description: "Tax Estimator" },
            { command: ".invest", description: "Investment Tips" },
            { command: ".gold", description: "Gold Price" },
            { command: ".bitcoin", description: "Bitcoin Price" },
            { command: ".budget", description: "Budget Planner" }
        ]
    },
    "20": {
        title: "TOOLS MENU",
        icon: "🛠️",
        items: [
            { command: ".qr", description: "QR Generator" },
            { command: ".barcode", description: "Barcode Maker" },
            { command: ".pdf", description: "Create PDF" },
            { command: ".compress", description: "Compress File" },
            { command: ".convert", description: "File Converter" },
            { command: ".timer", description: "Set Timer" },
            { command: ".alarm", description: "Set Alarm" },
            { command: ".notes", description: "Quick Notes" },
            { command: ".reminder", description: "Set Reminder" },
            { command: ".calculator", description: "Advanced Calc" },
            { command: ".unitconv", description: "Unit Converter" },
            { command: ".colorpick", description: "Color Picker" }
        ]
    },
    "21": {
        title: "SECURITY MENU",
        icon: "🔐",
        items: [
            { command: ".passgen", description: "Password Gen" },
            { command: ".encrypt", description: "Encrypt Text" },
            { command: ".decrypt", description: "Decrypt Text" },
            { command: ".iplookup", description: "IP Address Lookup" },
            { command: ".fakeinfo", description: "Fake Info Gen" },
            { command: ".emailcheck", description: "Check Email" },
            { command: ".scanlink", description: "Scan URL/Link" },
            { command: ".phonelook", description: "Phone Lookup" },
            { command: ".hash", description: "Hash Generator" },
            { command: ".base64", description: "Base64 En/Decode" },
            { command: ".whois", description: "Domain Lookup" }
        ]
    },
    "22": {
        title: "BUSINESS MENU",
        icon: "📊",
        items: [
            { command: ".invoice", description: "Invoice Maker" },
            { command: ".qrcode", description: "QR Code Maker" },
            { command: ".poll", description: "Create Poll" },
            { command: ".resume", description: "Resume Builder" },
            { command: ".schedule", description: "Schedule Maker" },
            { command: ".salescalc", description: "Sales Calculator" },
            { command: ".tasks", description: "Task Manager" },
            { command: ".email", description: "Email Template" },
            { command: ".contract", description: "Contract Draft" },
            { command: ".proposal", description: "Proposal Writer" },
            { command: ".budget", description: "Business Budget" }
        ]
    },
    "23": {
        title: "EDUCATION MENU",
        icon: "🧠",
        items: [
            { command: ".define", description: "Word Dictionary" },
            { command: ".grammar", description: "Grammar Checker" },
            { command: ".math", description: "Math Solver" },
            { command: ".science", description: "Science Facts" },
            { command: ".book", description: "Book Summary" },
            { command: ".periodic", description: "Periodic Table" },
            { command: ".geoquiz", description: "Geography Quiz" },
            { command: ".history", description: "History Facts" },
            { command: ".spell", description: "Spell Checker" },
            { command: ".synonym", description: "Synonyms/Antonyms" },
            { command: ".formula", description: "Math Formulas" },
            { command: ".studytip", description: "Study Tips" }
        ]
    },
    "24": {
        title: "TRANSLATION",
        icon: "🌐",
        items: [
            { command: ".translate", description: "Translate Text" },
            { command: ".detect", description: "Detect Language" },
            { command: ".meaning", description: "Word Meaning" },
            { command: ".langs", description: "50+ Languages" },
            { command: ".pronounce", description: "Pronunciation" },
            { command: ".phrases", description: "Common Phrases" },
            { command: ".para", description: "Paragraph Trans." },
            { command: ".slang", description: "Slang Dictionary" },
            { command: ".arabic", description: "Translate Arabic" },
            { command: ".french", description: "Translate French" },
            { command: ".spanish", description: "Translate Spanish" }
        ]
    },
    "25": {
        title: "STALK MENU",
        icon: "📱",
        items: [
            { command: ".whois", description: "WA Profile Info" },
            { command: ".lastseen", description: "Last Seen Check" },
            { command: ".pfp", description: "Profile Picture" },
            { command: ".status", description: "Check Status" },
            { command: ".stalklogs", description: "View Stalk Logs" },
            { command: ".trackname", description: "Track Name Change" },
            { command: ".ig", description: "Instagram Profile" },
            { command: ".fb", description: "Facebook Profile" },
            { command: ".twitter", description: "Twitter Profile" },
            { command: ".tiktok", description: "TikTok Profile" }
        ]
    },
    "26": {
        title: "AGENT MENU",
        icon: "🤖",
        items: [
            { command: ".agent", description: "Start AI Agent" },
            { command: ".autoreply", description: "Auto Reply Setup" },
            { command: ".autopost", description: "Auto Post Setup" },
            { command: ".scheduler", description: "Schedule Messages" },
            { command: ".broadcast", description: "Mass Message" },
            { command: ".keyword", description: "Keyword Trigger" },
            { command: ".flow", description: "Create Flow Bot" },
            { command: ".webhook", description: "Set Webhook" },
            { command: ".agentlog", description: "View Agent Logs" },
            { command: ".stopagent", description: "Stop Agent" }
        ]
    },
    "27": {
        title: "OWNER MENU",
        icon: "👑",
        items: [
            { command: ".addadmin", description: "Add Admin" },
            { command: ".removeadmin", description: "Remove Admin" },
            { command: ".block", description: "Block User" },
            { command: ".unblock", description: "Unblock User" },
            { command: ".broadcast", description: "Broadcast Msg" },
            { command: ".shutdown", description: "Shutdown Bot" },
            { command: ".restart", description: "Restart Bot" },
            { command: ".logs", description: "View All Logs" },
            { command: ".clearcache", description: "Clear Cache" },
            { command: ".setbotname", description: "Change Bot Name" },
            { command: ".announce", description: "Announcement" },
            { command: ".maintenance", description: "Maintenance Mode" }
        ]
    },
    "28": {
        title: "CHANNEL MENU",
        icon: "📢",
        items: [
            { command: ".joinchannel", description: "Join Channel" },
            { command: ".channelinfo", description: "Channel Info" },
            { command: ".channelpost", description: "Post to Chan." },
            { command: ".subscribers", description: "Sub Count" },
            { command: ".channellink", description: "Get Chan. Link" },
            { command: ".pin", description: "Pin Message" },
            { command: ".unpin", description: "Unpin Message" },
            { command: ".channelstats", description: "Channel Stats" },
            { command: ".promote", description: "Promote Chan." }
        ]
    },
    "29": {
        title: "STORE & WALLET",
        icon: "🛒",
        items: [
            { command: ".shop", description: "Open Store" },
            { command: ".buy", description: "Buy Item" },
            { command: ".balance", description: "Check Balance" },
            { command: ".deposit", description: "Add Funds" },
            { command: ".withdraw", description: "Withdraw Funds" },
            { command: ".transfer", description: "Send Coins" },
            { command: ".history", description: "Transaction Log" },
            { command: ".voucher", description: "Redeem Voucher" },
            { command: ".premium", description: "Get Premium" },
            { command: ".subscribe", description: "Subscribe Plan" },
            { command: ".prices", description: "View All Prices" }
        ]
    },
    "30": {
        title: "CLOUD STORAGE",
        icon: "📁",
        items: [
            { command: ".upload", description: "Upload File" },
            { command: ".download", description: "Download File" },
            { command: ".myfiles", description: "View My Files" },
            { command: ".delete", description: "Delete File" },
            { command: ".share", description: "Share File" },
            { command: ".storage", description: "Storage Used" },
            { command: ".rename", description: "Rename File" },
            { command: ".mkdir", description: "Create Folder" },
            { command: ".backup", description: "Backup Data" },
            { command: ".restore", description: "Restore Backup" }
        ]
    },
    "31": {
        title: "FAVOURITES",
        icon: "⭐",
        items: [
            { command: ".fav", description: "View Favourites" },
            { command: ".addfav", description: "Add to Favourites" },
            { command: ".removefav", description: "Remove Favourite" },
            { command: ".quick", description: "Quick Commands" },
            { command: ".pinned", description: "Pinned Tools" },
            { command: ".recent", description: "Recent History" },
            { command: ".saved", description: "Saved Results" },
            { command: ".clearfav", description: "Clear Favourites" }
        ]
    }
};
