import { Test, TestingModule } from '@nestjs/testing';
import { GreetController } from './greet.controller';

describe('GreetController', () => {
  let controller: GreetController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GreetController],
    }).compile();

    controller = module.get<GreetController>(GreetController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
