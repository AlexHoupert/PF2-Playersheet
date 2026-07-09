import backpackIcon from '../../assets/game-icons/backpack.svg';
import bookmarkletIcon from '../../assets/game-icons/bookmarklet.svg';
import bookshelfIcon from '../../assets/game-icons/bookshelf.svg';
import campfireIcon from '../../assets/game-icons/campfire.svg';
import cashIcon from '../../assets/game-icons/cash.svg';
import cloakDaggerIcon from '../../assets/game-icons/cloak-dagger.svg';
import compassIcon from '../../assets/game-icons/compass.svg';
import crossedSwordsIcon from '../../assets/game-icons/crossed-swords.svg';
import diceIcon from '../../assets/game-icons/dice-twenty-faces-twenty.svg';
import drinkIcon from '../../assets/game-icons/drink-me.svg';
import hammerNailsIcon from '../../assets/game-icons/hammer-nails.svg';
import heartBeatsIcon from '../../assets/game-icons/heart-beats.svg';
import hourglassIcon from '../../assets/game-icons/hourglass.svg';
import laurelsTrophyIcon from '../../assets/game-icons/laurels-trophy.svg';
import lightningArcIcon from '../../assets/game-icons/lightning-arc.svg';
import lockedChestIcon from '../../assets/game-icons/locked-chest.svg';
import magicSwirlIcon from '../../assets/game-icons/magic-swirl.svg';
import monsterGraspIcon from '../../assets/game-icons/monster-grasp.svg';
import potionBallIcon from '../../assets/game-icons/potion-ball.svg';
import progressionIcon from '../../assets/game-icons/progression.svg';
import rolledClothIcon from '../../assets/game-icons/rolled-cloth.svg';
import runningShoeIcon from '../../assets/game-icons/running-shoe.svg';
import scrollQuillIcon from '../../assets/game-icons/scroll-quill.svg';
import shakingHandsIcon from '../../assets/game-icons/shaking-hands.svg';
import skillsIcon from '../../assets/game-icons/skills.svg';
import swapBagIcon from '../../assets/game-icons/swap-bag.svg';
import treasureMapIcon from '../../assets/game-icons/treasure-map.svg';
import wolfHeadIcon from '../../assets/game-icons/wolf-head.svg';
import worldIcon from '../../assets/game-icons/world.svg';

export const PLAYER_NAV_ICON_SRC = {
    backpack: backpackIcon,
    bookmarklet: bookmarkletIcon,
    bookshelf: bookshelfIcon,
    campfire: campfireIcon,
    cash: cashIcon,
    'cloak-dagger': cloakDaggerIcon,
    compass: compassIcon,
    'crossed-swords': crossedSwordsIcon,
    'dice-twenty-faces-twenty': diceIcon,
    'drink-me': drinkIcon,
    'hammer-nails': hammerNailsIcon,
    'heart-beats': heartBeatsIcon,
    hourglass: hourglassIcon,
    'laurels-trophy': laurelsTrophyIcon,
    'lightning-arc': lightningArcIcon,
    'locked-chest': lockedChestIcon,
    'magic-swirl': magicSwirlIcon,
    'monster-grasp': monsterGraspIcon,
    'potion-ball': potionBallIcon,
    progression: progressionIcon,
    'rolled-cloth': rolledClothIcon,
    'running-shoe': runningShoeIcon,
    'scroll-quill': scrollQuillIcon,
    'shaking-hands': shakingHandsIcon,
    skills: skillsIcon,
    'swap-bag': swapBagIcon,
    'treasure-map': treasureMapIcon,
    'wolf-head': wolfHeadIcon,
    world: worldIcon,
};

export function getPlayerNavIconSrc(iconKey) {
    return PLAYER_NAV_ICON_SRC[iconKey] || skillsIcon;
}
