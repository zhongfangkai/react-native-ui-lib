import _ from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {Constants} from '../../helpers';
import {Colors} from '../../style';
import {BaseComponent} from '../../commons';
import View from '../view';
import Text from '../text';
import PageControl from '../pageControl';
import * as presenter from './CarouselPresenter';


const PAGE_CONTROL_POSITIONS = {
  NONE: 'none',
  OVER: 'over',
  UNDER: 'under'
}

/**
 * @description: Carousel for scrolling pages horizontally
 * @gif: https://media.giphy.com/media/l0HU7f8gjpRlMRhKw/giphy.gif, https://media.giphy.com/media/3oFzmcjX9OhpyckhcQ/giphy.gif
 * @example: https://github.com/wix/react-native-ui-lib/blob/master/demo/src/screens/componentScreens/CarouselScreen.js
 * @extends: ScrollView
 * @extendsLink: https://facebook.github.io/react-native/docs/scrollview 
 * @notes: This is screed width Component
 */
export default class Carousel extends BaseComponent {
  static displayName = 'Carousel';
  
  static propTypes = {
    /**
     * the first page to start with
     */
    initialPage: PropTypes.number,
    /**
     * the page width (all pages should have the same width)
     */
    pageWidth: PropTypes.number,
    /**
     * the spacing between the items
     */
    itemSpacings: PropTypes.number,
    /**
     * if true, will have infinite scroll
     */
    loop: PropTypes.bool,
    /**
     * callback for when page has changed
     */
    onChangePage: PropTypes.func,
    /**
     * callback for onScroll event of the internal ScrollView
     */
    onScroll: PropTypes.func,
    /**
     * the carousel style
     */
    containerStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.number, PropTypes.array]),
    /**
     * PageControl component props
     */
    pageControlProps: PropTypes.shape(PageControl.propTypes),
    /**
     * The position of the PageControl component ['over', 'under']
     */
    pageControlPosition: PropTypes.oneOf(Object.values(PAGE_CONTROL_POSITIONS)),
    /**
     * whether to show a page counter (will not work with pageWidths)
     */
    showCounter: PropTypes.bool,
    /**
     * the counter's text style
     */
    counterTextStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.number, PropTypes.array]),
  };

  static defaultProps = {
    initialPage: 0,
    itemSpacings: 12,
    pageControlPosition: PAGE_CONTROL_POSITIONS.NONE
  };

  static pageControlPositions = PAGE_CONTROL_POSITIONS;

  constructor(props) {
    super(props);
    
    this.carousel = React.createRef();
    const defaultPageWidth = props.pageWidth + props.itemSpacings || Constants.screenWidth;
    const loopOffset = props.loop && props.pageWidth ? (Constants.screenWidth - defaultPageWidth) / 2 : 0;
    
    this.state = {
      currentPage: props.initialPage,
      currentStandingPage: props.initialPage,
      pageWidth: defaultPageWidth,
      initialOffset: {x: presenter.calcOffset(props, {currentPage: props.initialPage, pageWidth: defaultPageWidth}) - loopOffset}
    };
  }

  componentDidMount() {
    Constants.addDimensionsEventListener(this.onOrientationChanged);
  }

  componentWillUnmount() {
    Constants.removeDimensionsEventListener(this.onOrientationChanged);
  }

  onOrientationChanged = () => {
    if (!this.props.pageWidth) {
      this.setState({pageWidth: Constants.screenWidth});
      this.goToPage(this.state.currentPage, true);
    }
  }

  generateStyles() {
    this.styles = createStyles(this.props);
  }

  updateOffset = (animated = false) => {
    const centerOffset = this.props.pageWidth ? (Constants.screenWidth - this.state.pageWidth) / 2 : 0;
    const x = presenter.calcOffset(this.props, this.state) - centerOffset;
    
    if (this.carousel) {
      this.carousel.current.scrollTo({x, animated});
      
      if (Constants.isAndroid) {
        // this is done to handle onMomentumScrollEnd not being called in Android:
        // https://github.com/facebook/react-native/issues/11693
        // https://github.com/facebook/react-native/issues/19246
        this.onMomentumScrollEnd();
      }
    }
  }

  goToPage(pageIndex, animated = true) {
    this.setState({currentPage: pageIndex}, () => this.updateOffset(animated));
  }

  shouldAddPadding() {
    const {loop, pageWidth} = this.props;
    return !loop && pageWidth;
  }

  onContentSizeChange = () => {
    if (Constants.isAndroid) {
      this.updateOffset();
    }
  }

  // finished full page scroll
  onMomentumScrollEnd = () => {
    const {currentStandingPage, currentPage} = this.state;
    this.setState({currentStandingPage: currentPage});  
    if (currentStandingPage !== currentPage) {
      _.invoke(this.props, 'onChangePage', currentPage, currentStandingPage);
    }
  }

  onScroll = (event) => {
    if (!this.skippedInitialScroll) {
      this.skippedInitialScroll = true;
      return;
    }

    const {loop} = this.props;
    const {pageWidth} = this.state;
    const offsetX = presenter.getDirectionOffset(event.nativeEvent.contentOffset.x, this.props, pageWidth);
    
    if (offsetX >= 0) {
      const newPage = presenter.calcPageIndex(offsetX, this.props, pageWidth);
      this.setState({currentPage: newPage});
    }

    if (loop && presenter.isOutOfBounds(offsetX, this.props, pageWidth)) {
      this.updateOffset();
    }
    
    _.invoke(this.props, 'onScroll', event);
  }

  renderChild = (child, key) => {
    return (
      <View style={{width: this.state.pageWidth, paddingLeft: this.props.pageWidth && this.props.itemSpacings}} key={key}>
        {child}
      </View>
    );
  }

  renderChildren() {
    const {children, loop, pageWidth} = this.props;
    const length = presenter.getChildrenLength(this.props);
    
    const childrenArray = React.Children.map(children, (child, index) => {
      return this.renderChild(child, `${index}`);
    });

    if (loop) {
      childrenArray.unshift(this.renderChild(children[length - 1], `${length - 1}-clone`));
      childrenArray.push(this.renderChild(children[0], `${0}-clone`));
      if (pageWidth) {
        childrenArray.push(this.renderChild(children[1], `${1}-clone`));
      }
    }
    
    return childrenArray;
  }

  renderPageControl() {
    const {pageControlPosition, pageControlProps} = this.props;

    if (pageControlPosition === PAGE_CONTROL_POSITIONS.NONE) {
      return;
    }

    const pagesCount = presenter.getChildrenLength(this.props);
    const containerStyle = pageControlPosition === PAGE_CONTROL_POSITIONS.UNDER ? 
      {marginVertical: 16} : {position: 'absolute', bottom: 16, alignSelf: 'center'};

    return (
      <PageControl 
        size={6}
        containerStyle={containerStyle}
        inactiveColor={Colors.dark60}
        color={Colors.dark20}
        {...pageControlProps}
        numOfPages={pagesCount} 
        currentPage={this.state.currentPage}
      />
    );
  }

  renderCounter() {
    const {pageWidth, showCounter, counterTextStyle} = this.props;
    const {currentPage} = this.state;
    const pagesCount = presenter.getChildrenLength(this.props);

    if (showCounter && !pageWidth) {
      return (
        <View center style={this.styles.counter}>
          <Text dark80 text90 style={[{fontWeight: 'bold'}, counterTextStyle]}>{currentPage + 1}/{pagesCount}</Text>
        </View>
      );
    }
  }

  render() {
    const {containerStyle, ...others} = this.props;
    const {initialOffset, pageWidth} = this.state;

    return (
      <View style={containerStyle}>
        <ScrollView
          {...others}
          ref={this.carousel} 
          contentContainerStyle={{paddingRight: this.shouldAddPadding() ? this.props.itemSpacings : undefined}}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={pageWidth}
          snapToAlignment={'center'}
          decelerationRate="fast"
          contentOffset={initialOffset}
          scrollEventThrottle={200}
          onScroll={this.onScroll}
          onContentSizeChange={this.onContentSizeChange}
          onMomentumScrollEnd={this.onMomentumScrollEnd}
        >
          {this.renderChildren()}
        </ScrollView>
        {this.renderPageControl()}
        {this.renderCounter()}
      </View>
    );
  }
}

function createStyles() {
  return StyleSheet.create({
    counter: {
      paddingHorizontal: 8, 
      paddingVertical: 3, // height: 24, 
      borderRadius: 20, 
      backgroundColor: Colors.rgba(Colors.black, 0.6),
      position: 'absolute',
      top: 12,
      right: 12
    }
  });
}
